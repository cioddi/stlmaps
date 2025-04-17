import React, {
  useRef,
  useEffect,
  useMemo,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import ReactDOM from "react-dom";
import Moveable from "react-moveable";
import { useMap, useMapState } from "@mapcomponents/react-maplibre";
import * as turf from "@turf/turf";
import { LngLatLike, Map as MapType, PointLike, Marker } from "maplibre-gl";
import { Units } from "@turf/turf";
import { Feature } from "geojson";
	

export interface BboxSelectorOptions {
  topLeft?: [number, number] | undefined;
  scale: [number, number] | undefined;
  rotate: number;
  width: number;
  height: number;
  fixedScale?: boolean;
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

/**
 * BboxSelector component renders a transformable (drag, scale, rotate) preview of the desired export or print content
 */
const BboxSelector = forwardRef((props: Props, ref) => {
	
  const targetRef = useRef<HTMLDivElement>(null);
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

  // Initialize the marker when the map is available
  useEffect(() => {
    if (!mapHook.map) return;

    // Create container for the marker
    containerRef.current = document.createElement("div");

    // Initialize the MapLibre marker - using top-left as anchor point
    const maplibreMarker = new Marker({
      element: containerRef.current,
      anchor: "top-left",
    });

    // Set marker position based on available coordinates
    // Default to center of map if no coordinates are provided
    const _centerX = Math.round(mapHook.map.map._container.clientWidth / 2);
    const _centerY = Math.round(mapHook.map.map._container.clientHeight / 2);
    const _center = mapHook.map.map.unproject([_centerX, _centerY]);
    const centerPixel = mapHook.map.map.project(_center);

    // Calculate top-left corner from the center point
    const topLeftPixelX = centerPixel.x - props.options.width / 2;
    const topLeftPixelY = centerPixel.y - props.options.height / 2;
    const topLeftLngLat = mapHook.map.map.unproject([
      topLeftPixelX,
      topLeftPixelY,
    ]);

    maplibreMarker.setLngLat(topLeftLngLat);

    maplibreMarker.addTo(mapHook.map.map);

    setMarker(maplibreMarker);

    mapHook.map.map.setPitch(0);
    const _maxPitch = mapHook.map.map.getMaxPitch();
    mapHook.map.map.setMaxPitch(0);

    const updateTargetDimensions = () => {
      if (targetRef.current && !targetRef.current.style.width) {
        targetRef.current.style.width = props.options.width + "px";
        targetRef.current.style.height = props.options.height + "px";
        moveableRef.current?.updateRect();
        updateBbox();
      }
    };
    if (!targetRef.current) {
      setTimeout(updateTargetDimensions, 100);
    } else {
      updateTargetDimensions();
    }
    updateBbox();

    return () => {
      maplibreMarker.remove();
      containerRef.current?.remove();
      mapHook.map?.map.setMaxPitch(_maxPitch);
    };
  }, [mapHook.map]);

  const updateBbox = React.useCallback(() => {
    if (targetRef.current && mapHook.map && marker) {
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

      // Calculate the remaining corner points for the bbox using the actual scaled dimensions
      const topRightPixelX = topLeftX + actualWidth;
      const topRightPixelY = topLeftY;
      const bottomLeftPixelX = topLeftX;
      const bottomLeftPixelY = topLeftY + actualHeight;
      const bottomRightPixelX = topLeftX + actualWidth;
      const bottomRightPixelY = topLeftY + actualHeight;

      // Convert all corner points to geographical coordinates
      const topRight = mapHook.map.map.unproject([
        topRightPixelX,
        topRightPixelY,
      ]);
      const bottomLeft = mapHook.map.map.unproject([
        bottomLeftPixelX,
        bottomLeftPixelY,
      ]);
      const bottomRight = mapHook.map.map.unproject([
        bottomRightPixelX,
        bottomRightPixelY,
      ]);

      // Create the GeoJSON feature representing the bbox
      const _geoJson = {
        type: "Feature",
        bbox: [
          topLeftLngLat.lng,
          topLeftLngLat.lat,
          bottomRight.lng,
          bottomRight.lat,
        ],
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
      } as Feature;

      setBbox(_geoJson);
    }
  }, [mapHook.map, marker]);

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
            if (
              e.inputEvent instanceof MouseEvent &&
              targetRef.current &&
              containerRef.current
            ) {
              // Get the current element dimensions and position
              const targetRect = targetRef.current.getBoundingClientRect();

              // Store offsets as data attributes on the container
              containerRef.current.dataset.offsetX = String(
                e.inputEvent.clientX - targetRect.left - targetRect.width / 2
              );
              containerRef.current.dataset.offsetY = String(
                e.inputEvent.clientY - targetRect.top - targetRect.height / 2
              );
            }
          }}
          onDrag={(e) => {
            // Apply transform during drag
            e.target.style.transform = e.transform;
          }}
          onDragEnd={(e) => {
            // Important: Do not reset the transform here as we need it for positioning
            // Let the updateBbox function handle all positioning calculations
            updateBbox();
          }}
          /* scalable */
          scalable={props.options.fixedScale ? false : true}
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
