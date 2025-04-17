import React, { useRef, useEffect, useMemo, useState, forwardRef, useImperativeHandle } from "react";
import ReactDOM from "react-dom";
import Moveable from "react-moveable";
import { useMap, useMapState } from "@mapcomponents/react-maplibre";
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
 */
const BboxSelector = forwardRef((props: Props, ref) => {
  const [options, setOptions] = React.useState<BboxSelectorOptions>(
    props.options
  );
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

  function onChangeDebounced(bbox: Feature, debounceMs = 1000) {
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      props.onChange?.(bbox);
    }, debounceMs);
    setDebounceTimer(timer);
  }

  useEffect(() => {
    if (bbox) {
      onChangeDebounced(bbox);
    }
  }, [bbox]);

  useEffect(() => {
    if (typeof props.setOptions === "function") {
      props.setOptions(options);
    }
  }, [options, props]);

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

  // Initialize the marker when the map is available
  useEffect(() => {
    if (!mapHook.map) return;

    // Create container for the marker
    containerRef.current = document.createElement('div');

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

    maplibreMarker.addTo(mapHook.map.map);

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

  const transformOrigin = useMemo<[number, number]>(() => {
    return [options.width / 2, options.height / 2];
  }, [options.width, options.height]);

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
  }, [mapHook.map, options.width, options.height, options.topLeft, options.fixedScale]);  // Helper function to update the bbox based on current state
  const updateBbox = React.useCallback(() => {
    if (targetRef.current && mapHook.map && marker && transformOrigin?.[0]) {
      moveableRef.current?.updateRect();

      // Get the map container and target element positions
      const mapContainer = mapHook.map.map.getContainer();
      const mapRect = mapContainer.getBoundingClientRect();
      const targetRect = targetRef.current.getBoundingClientRect();
      
      // Use the actual scaled dimensions from getBoundingClientRect
      const actualWidth = targetRect.width;
      const actualHeight = targetRect.height;
      
      // Calculate the top-left corner position in pixels relative to the map
      const topLeftX = targetRect.left - mapRect.left;
      const topLeftY = targetRect.top - mapRect.top;
      
      // Convert the pixel coordinates to geographical coordinates
      const topLeftLngLat = mapHook.map.map.unproject([topLeftX, topLeftY]);
      
      // Update the marker position to match the calculated top-left corner
      //marker.setLngLat(topLeftLngLat);
      
      // Store the current scale to update options
      const scaleX = actualWidth / options.width;
      const scaleY = actualHeight / options.height;
      
      // Update the state with new coordinates and scale
      setOptions((val: BboxSelectorOptions) => ({
        ...val,
        topLeft: [topLeftLngLat.lng, topLeftLngLat.lat],
        scale: [scaleX, scaleY]
      }));

      // Calculate the remaining corner points for the bbox using the actual scaled dimensions
      const topRightPixelX = topLeftX + actualWidth;
      const topRightPixelY = topLeftY;
      const bottomLeftPixelX = topLeftX;
      const bottomLeftPixelY = topLeftY + actualHeight;
      const bottomRightPixelX = topLeftX + actualWidth;
      const bottomRightPixelY = topLeftY + actualHeight;

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
        properties: { bearing: getTargetRotationAngle(targetRef.current) },
      } as Feature;

      setBbox(_geoJson);
    }
  }, [mapHook.map, options.width, options.height, transformOrigin]);

  // Expose updateBbox method through ref
  useImperativeHandle(ref, () => ({
    updateBbox
  }));

    // Update element styling and position when needed without updating bbox
  useEffect(() => {
    if (targetRef.current && !targetRef.current.style.width && mapHook.map && transformOrigin?.[0]) {
      targetRef.current.style.width = options.width + "px";
      targetRef.current.style.height = options.height + "px";
      moveableRef.current?.updateRect();
      updateBbox();
    }
  }, [
    options?.height,
    options?.width,
    transformOrigin,
    mapHook.map
  ]);


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
          onScaleStart={(e) => {
            // Stop propagation of mouse events to prevent map interactions
            if (e.inputEvent) {
              e.inputEvent.stopPropagation();
              e.inputEvent.preventDefault();
            }
          }}
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
