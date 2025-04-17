import React, { useRef, useEffect, useMemo, useState, forwardRef, useImperativeHandle } from "react";
import ReactDOM from "react-dom";
import Moveable from "react-moveable";
import { useMap, useMapState, MlGeoJsonLayer } from "@mapcomponents/react-maplibre";
import * as turf from "@turf/turf";
import { LngLatLike, Map as MapType, PointLike, Marker } from "maplibre-gl";
import { Units } from "@turf/turf";
import { Feature } from "geojson";

export interface BboxSelectorOptions {
  topLeft: [number, number] | undefined;
  scale: [number, number] | undefined;
  rotate: number;
  width: number;
  height: number;
  fixedScale?: number | false;
}

type Props = {
  /**
   * Id of the target MapLibre instance in mapContext
   */
  mapId?: string;
  /**
   * a state variable containing the PDF previews current state
   */
  options: BboxSelectorOptions;
  /**
   * setter function to update the current PDF preview state
   */
  setOptions?: (
    arg1:
      | ((val: BboxSelectorOptions) => BboxSelectorOptions)
      | BboxSelectorOptions
  ) => void;
  onChange?: (geojson: Feature) => void;
};

// Mode for the bbox selector
type BboxSelectorMode = "view" | "edit";

function getTargetRotationAngle(target: HTMLDivElement) {
  const el_style = window.getComputedStyle(target, null);
  const el_transform = el_style.getPropertyValue("transform");

  let deg = 0;

  if (el_transform !== "none") {
    const values = el_transform.split("(")[1].split(")")[0].split(",");
    const a = parseFloat(values[0]);
    const b = parseFloat(values[1]);
    deg = Math.round(Math.atan2(b, a) * (180 / Math.PI));
  }

  return deg < 0 ? deg + 360 : deg;
}

function calcElemTransformedPoint(
  el: HTMLDivElement,
  point: [number, number],
  transformOrigin: [number, number]
): PointLike {
  const style = getComputedStyle(el);
  const p = [point[0] - transformOrigin[0], point[1] - transformOrigin[1]];

  const matrix = new DOMMatrixReadOnly(style.transform);

  // transform pixel coordinates according to the css transform state of "el" (target)
  return [
    p[0] * matrix.a + p[1] * matrix.c + matrix.e + transformOrigin[0],
    p[0] * matrix.b + p[1] * matrix.d + matrix.f + transformOrigin[1],
  ];
}

// measure distance in pixels that is used to determine the current css transform.scale relative to the maps viewport.zoom
const scaleAnchorInPixels = 10;

// used to determine the MapZoomScale modifier which is multiplied with options.scale to relate the scale to the current map viewport.zoom
function getMapZoomScaleModifier(point: [number, number], _map: MapType) {
  const left = _map.unproject(point);
  const right = _map.unproject([point[0] + scaleAnchorInPixels, point[1]]);
  const maxMeters = left.distanceTo(right);
  return scaleAnchorInPixels / maxMeters;
}

/**
 * BboxSelector component renders a transformable (drag, scale, rotate) preview of the desired export or print content
 * with two modes: view (just displays the bbox) and edit (allows transformation)
 */
const BboxSelector = forwardRef((props: Props, ref) => {
  const [options, setOptions] = React.useState<BboxSelectorOptions>(
    props.options
  );
  const [mode, setMode] = useState<BboxSelectorMode>("view");
  const mapState = useMapState({
    mapId: props.mapId,
    watch: { layers: false, viewport: true },
  });
  const targetRef = useRef<HTMLDivElement>(null);
  const fixedScaleRef = useRef<number | null>(null);
  const moveableRef = useRef<Moveable>(null);
  const mapHook = useMap({
    mapId: props.mapId,
  });
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [bbox, setBbox] = useState<Feature | undefined>(undefined);
  const [marker, setMarker] = useState<Marker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousViewportRef = useRef(mapState.viewport);

  // Function to handle GeoJSON feature click to switch to edit mode
  const handleFeatureClick = React.useCallback(() => {
    if (mode === "view") {
      setMode("edit");

      // Small delay to ensure marker is properly positioned when entering edit mode
      setTimeout(() => {
        if (marker && containerRef.current) {
          containerRef.current.style.opacity = "1";
        }
        if (moveableRef.current) {
          moveableRef.current.updateTarget();
        }
      }, 10);
    }
  }, [mode, marker]);

  // Debounced onChange handler
  function onChangeDebounced(bbox: Feature, debounceMs = 1000) {
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      props.onChange?.(bbox);
    }, debounceMs);
    setDebounceTimer(timer);
  }

  // Update bbox and trigger onChange when it changes
  useEffect(() => {
    if (bbox) {
      onChangeDebounced(bbox);
    }
  }, [bbox]);

  // Sync options with props
  useEffect(() => {
    if (typeof props.setOptions === "function") {
      props.setOptions(options);
    }
  }, [options, props]);

  // Set initial options from props
  useEffect(() => {
    if (props?.options?.topLeft && mapHook.map) {
      const _centerX = Math.round(mapHook.map.map._container.clientWidth / 2);
      const _centerY = Math.round(mapHook.map.map._container.clientHeight / 2);

      const bbox_size = _centerX < _centerY ? _centerX : _centerY;

      const scale =
        1 / getMapZoomScaleModifier([_centerX, _centerY], mapHook.map.map);

      setOptions((val: BboxSelectorOptions) => ({
        ...val,
        scale: [scale, scale],
        width: bbox_size,
        height: bbox_size,
        topLeft: props?.options?.topLeft,
      }));
    }
  }, [mapHook.map, props.options?.topLeft]);

  // Handle map changes that should switch back to view mode
  useEffect(() => {
    if (!mapState?.viewport) return;

    const currentViewport = mapState.viewport;
    const previousViewport = previousViewportRef.current;

    if (previousViewport &&
      (previousViewport.center !== currentViewport.center ||
        previousViewport.zoom !== currentViewport.zoom ||
        previousViewport.bearing !== currentViewport.bearing ||
        previousViewport.pitch !== currentViewport.pitch)) {
      // Map view has changed, switch to view mode
      if (mode === "edit") {
        setMode("view");
      }
    }

    // Store the current viewport for future comparison
    previousViewportRef.current = currentViewport;
  }, [mapState.viewport, mode]);

  // Initialize default values if not set
  useEffect(() => {
    if (!mapState?.viewport?.zoom || !mapHook.map) return;

    const _centerX = Math.round(mapHook.map.map._container.clientWidth / 2);
    const _centerY = Math.round(mapHook.map.map._container.clientHeight / 2);

    if (!options.scale) {
      const scale =
        1 / getMapZoomScaleModifier([_centerX, _centerY], mapHook.map.map);

      setOptions((val: BboxSelectorOptions) => ({
        ...val,
        scale: [scale, scale],
      }));
    }
    if (!options.topLeft) {
      // Calculate default topLeft from map center, offset by half width/height
      const _center = mapHook.map.map.unproject([_centerX, _centerY]);
      const centerPixel = mapHook.map.map.project(_center);

      // Default dimensions if not set
      const _width = options.width || 200;
      const _height = options.height || 200;

      // Calculate topLeft corner from the center point
      const topLeftPixelX = centerPixel.x - _width / 2;
      const topLeftPixelY = centerPixel.y - _height / 2;
      const topLeftLngLat = mapHook.map.map.unproject([topLeftPixelX, topLeftPixelY]);

      setOptions((val: BboxSelectorOptions) => ({
        ...val,
        topLeft: [topLeftLngLat.lng, topLeftLngLat.lat],
      }));
    }
  }, [mapHook.map, mapState.viewport?.zoom, options?.scale, options?.topLeft, options.width, options.height]);

  // Initialize the marker when the map is available
  useEffect(() => {
    if (!mapHook.map) return;

    // Create container for the marker - only used in edit mode
    containerRef.current = document.createElement('div');
    containerRef.current.style.opacity = mode === "edit" ? "1" : "0";

    // Initialize the MapLibre marker - using top-left as anchor point
    const maplibreMarker = new Marker({
      element: containerRef.current,
      anchor: 'top-left',
    });

    // Set marker position based on available coordinates
    if (options.topLeft) {
      // Directly use topLeft coordinates
      maplibreMarker.setLngLat(options.topLeft as LngLatLike);
    } else {
      // Default to center of map if no coordinates are provided
      const _centerX = Math.round(mapHook.map.map._container.clientWidth / 2);
      const _centerY = Math.round(mapHook.map.map._container.clientHeight / 2);
      const _center = mapHook.map.map.unproject([_centerX, _centerY]);
      const centerPixel = mapHook.map.map.project(_center);

      // Calculate top-left corner from the center point
      const topLeftPixelX = centerPixel.x - options.width / 2;
      const topLeftPixelY = centerPixel.y - options.height / 2;
      const topLeftLngLat = mapHook.map.map.unproject([topLeftPixelX, topLeftPixelY]);

      // Update options with calculated topLeft
      setOptions(val => ({
        ...val,
        topLeft: [topLeftLngLat.lng, topLeftLngLat.lat]
      }));

      maplibreMarker.setLngLat(topLeftLngLat);
    }

    // Only add the marker to the map in edit mode
    if (mode === "edit") {
      maplibreMarker.addTo(mapHook.map.map);
    }

    setMarker(maplibreMarker);

    mapHook.map.map.setPitch(0);
    const _maxPitch = mapHook.map.map.getMaxPitch();
    mapHook.map.map.setMaxPitch(0);
    updateBbox();

    return () => {
      maplibreMarker.remove();
      containerRef.current?.remove();
      mapHook.map?.map.setMaxPitch(_maxPitch);
    };
  }, [mapHook.map]);

  // Update marker visibility and position when mode or topLeft coordinates change
  useEffect(() => {
    if (!marker || !mapHook.map) return;

    if (mode === "edit") {
      // Make sure marker is added to the map
      marker.addTo(mapHook.map.map);

      if (containerRef.current) {
        // Fade in the marker for edit mode
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.style.opacity = "1";
          }
        }, 100);
      }

      // Update position if we have topLeft coordinates
      if (options.topLeft) {
        marker.setLngLat(options.topLeft as LngLatLike);
      }
    } else {
      // In view mode, remove the marker from the map
      marker.remove();

      if (containerRef.current) {
        containerRef.current.style.opacity = "0";
      }
    }
  }, [mode, marker, options.topLeft, mapHook.map]);

  const transformOrigin = useMemo<[number, number]>(() => {
    return [options.width / 2, options.height / 2];
  }, [options.width, options.height]);

  const transform = useMemo(() => {
    if (!mapHook.map || !options.scale) return "none";

    // We'll still calculate the scale and rotation for the inner element
    // but rely on the marker for positioning
    const x = 0;
    const y = 0;

    const scale =
      options.scale[0] * (mapHook.map && options.topLeft ?
        getMapZoomScaleModifier([
          mapHook.map.map.project(options.topLeft as LngLatLike).x,
          mapHook.map.map.project(options.topLeft as LngLatLike).y
        ], mapHook.map.map) : 1);

    const viewportBearing = mapState?.viewport?.bearing
      ? mapState.viewport?.bearing
      : 0;

    const _transform = `rotate(${options.rotate - viewportBearing
      }deg) scale(${scale},${scale})`;

    if (targetRef.current) targetRef.current.style.transform = _transform;

    return _transform;
  }, [
    mapHook.map,
    mapState.viewport,
    options.scale,
    options.rotate,
    options.topLeft,
  ]);

  useEffect(() => {
    if (mode === "edit" && moveableRef.current) {
      moveableRef.current.updateTarget();
    }
  }, [transform, mode]);

  useEffect(() => {
    // update options.scale if fixedScale was changed
    if (
      !mapHook.map ||
      !options?.topLeft ||
      !options?.fixedScale ||
      (typeof options?.fixedScale !== "undefined" &&
        fixedScaleRef.current === options?.fixedScale)
    )
      return;

    fixedScaleRef.current = options.fixedScale;

    // Calculate the center point from topLeft and dimensions
    const topLeftPixel = mapHook.map.map.project(options.topLeft as LngLatLike);
    const centerPixelX = topLeftPixel.x + options.width / 2;
    const centerPixelY = topLeftPixel.y + options.height / 2;
    const centerLngLat = mapHook.map.map.unproject([centerPixelX, centerPixelY]);

    // Create point from center coordinates for turf calculations
    const point = turf.point([centerLngLat.lng, centerLngLat.lat]);
    const distance = options.fixedScale * (options.width / 1000);

    const bearing = 90;
    const _options = { units: "meters" as Units };
    const destination = turf.destination(point, distance, bearing, _options);

    const centerInPixels = mapHook.map.map.project(
      point.geometry.coordinates as LngLatLike
    );
    const destinationInPixels = mapHook.map.map.project(
      destination.geometry.coordinates as LngLatLike
    );

    const scaleFactor =
      (Math.round(destinationInPixels.x - centerInPixels.x) / options.width) *
      (1 /
        getMapZoomScaleModifier(
          [centerInPixels.x, centerInPixels.y],
          mapHook.map.map
        ));
    setOptions((val: BboxSelectorOptions) => ({
      ...val,
      scale: [scaleFactor, scaleFactor],
    }));
  }, [mapHook.map, options.width, options.height, options.topLeft, options.fixedScale]);

  // Helper function to update the bbox based on current state
  const updateBbox = React.useCallback(() => {
    if (targetRef.current && mapHook.map && marker && transformOrigin?.[0]) {
      let _width = options.width;
      let _height = options.height;
      targetRef.current.style.width = options.width + "px";
      targetRef.current.style.height = options.height + "px";
      if (mode === "edit" && moveableRef.current) {
        moveableRef.current.updateRect();
      }

      // Get the map container and target element positions
      const mapContainer = mapHook.map.map.getContainer();
      const mapRect = mapContainer.getBoundingClientRect();
      const targetRect = targetRef.current.getBoundingClientRect();

      // Calculate the top-left corner position in pixels relative to the map
      const topLeftX = targetRect.left - mapRect.left;
      const topLeftY = targetRect.top - mapRect.top;

      // Convert the pixel coordinates to geographical coordinates
      const topLeftLngLat = mapHook.map.map.unproject([topLeftX, topLeftY]);

      // Update the marker position to match the calculated top-left corner
      if (mode === "edit" && marker) {
        marker.setLngLat(topLeftLngLat);
      }

      // Calculate center for backwards compatibility
      const centerPixelX = topLeftX + _width / 2;
      const centerPixelY = topLeftY + _height / 2;
      const centerLngLat = mapHook.map.map.unproject([centerPixelX, centerPixelY]);

      // Update the state with new coordinates - primarily topLeft, but also keeping center for compatibility
      setOptions((val: BboxSelectorOptions) => ({
        ...val,
        topLeft: [topLeftLngLat.lng, topLeftLngLat.lat],
        center: [centerLngLat.lng, centerLngLat.lat],
      }));

      // Calculate the remaining corner points for the bbox
      const topRightPixelX = topLeftX + _width;
      const topRightPixelY = topLeftY;
      const bottomLeftPixelX = topLeftX;
      const bottomLeftPixelY = topLeftY + _height;
      const bottomRightPixelX = topLeftX + _width;
      const bottomRightPixelY = topLeftY + _height;

      // Convert all corner points to geographical coordinates
      const topRight = mapHook.map.map.unproject([topRightPixelX, topRightPixelY]);
      const bottomLeft = mapHook.map.map.unproject([bottomLeftPixelX, bottomLeftPixelY]);
      const bottomRight = mapHook.map.map.unproject([bottomRightPixelX, bottomRightPixelY]);

      // Create the GeoJSON feature representing the bbox
      const _geoJson = {
        type: "Feature",
        bbox: [topLeftLngLat.lng, topLeftLngLat.lat, bottomRight.lng, bottomRight.lat],
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [topLeftLngLat.lng, topLeftLngLat.lat],
              [topRight.lng, topRight.lat],
              [bottomRight.lng, bottomRight.lat],
              [bottomLeft.lng, bottomLeft.lat],
              [topLeftLngLat.lng, topLeftLngLat.lat],
            ],
          ],
        },
        properties: {
          bearing: getTargetRotationAngle(targetRef.current),
          mode: mode // Store current mode in the GeoJSON properties
        },
      } as Feature;

      setBbox(_geoJson);
    }
  }, [mapHook.map, options.width, options.height, transformOrigin, mode, marker]);

  // Expose updateBbox method through ref
  useImperativeHandle(ref, () => ({
    updateBbox,
    setMode
  }));

  // Update element styling and position when needed without updating bbox
  useEffect(() => {
    if (targetRef.current && mapHook.map && transformOrigin?.[0]) {
      targetRef.current.style.width = options.width + "px";
      targetRef.current.style.height = options.height + "px";
      if (mode === "edit" && moveableRef.current) {
        moveableRef.current.updateTarget();
      }
    }
  }, [
    options?.height,
    options?.width,
    transformOrigin,
    mapHook.map,
    transform,
    mode
  ]);

  // Render nothing if bbox isn't created yet
  if (!bbox) {
    return null;
  }

  // For view mode, just render the GeoJSON layer
  if (mode === "view") {
    return (
      <MlGeoJsonLayer
        mapId={props.mapId}
        geojson={bbox}
        fillOpacity={0.2}
        fillColor="#3388ff"
        lineColor="#3388ff"
        lineWidth={2}
        onClick={handleFeatureClick}
      />
    );
  }

  // For edit mode, render the moveable component with the marker
  return containerRef.current ? (
    ReactDOM.createPortal(
      <>
        <div
          className="target"
          ref={targetRef}
          style={{ transformOrigin: "center center" }}
        ></div>
        <Moveable
          // eslint-disable-next-line
          // @ts-ignore:
          ref={moveableRef}
          target={targetRef}
          container={null}
          origin={true}
          keepRatio={true}
          /* draggable */
          draggable={true}
          onDragStart={(e) => {
            // Stop propagation of mouse events to prevent map dragging
            if (e.inputEvent) {
              e.inputEvent.stopPropagation();
              e.inputEvent.preventDefault();
            }

            // Store initial offset for use during drag
            if (e.inputEvent instanceof MouseEvent && targetRef.current && containerRef.current) {
              // Get the current element dimensions and position
              const targetRect = targetRef.current.getBoundingClientRect();

              // Store offsets as data attributes on the container
              containerRef.current.dataset.offsetX = String(e.inputEvent.clientX - targetRect.left - targetRect.width / 2);
              containerRef.current.dataset.offsetY = String(e.inputEvent.clientY - targetRect.top - targetRect.height / 2);
            }
          }}

          onDrag={e => {
            // Apply transform during drag
            e.target.style.transform = e.transform;
          }}
          onDragEnd={(e) => {
            // Important: Do not reset the transform here as we need it for positioning
            // Let the updateBbox function handle all positioning calculations
            updateBbox();
          }}
          /* scalable */
          scalable={options.fixedScale ? false : true}
          onScale={(e) => {
            e.target.style.transform = e.drag.transform;
          }}
          onScaleEnd={() => {
            updateBbox();
          }}
          /* rotatable */
          rotatable={false}
        />
      </>,
      containerRef.current
    )
  ) : (
    <></>
  );
});

export default BboxSelector;
