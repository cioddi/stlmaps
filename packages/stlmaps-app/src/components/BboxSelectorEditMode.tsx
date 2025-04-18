import React, { useRef, useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import Moveable from "react-moveable";
import { Map as MapType, Marker } from "maplibre-gl";
import { Feature } from "geojson";
import { BboxSelectorOptions } from "./BboxSelector";

type BboxSelectorEditModeProps = {
  mapId?: string;
  options: BboxSelectorOptions;
  bbox: Feature;
  mapHook: any;
  onBboxUpdate: (updatedBbox: Feature) => void;
};

/**
 * BboxSelectorEditMode handles the edit mode UI for bbox selection
 */
const BboxSelectorEditMode: React.FC<BboxSelectorEditModeProps> = ({
  mapId,
  options,
  bbox,
  mapHook,
  onBboxUpdate,
}) => {
  const initializedRef = useRef(false);
  const maplibreMarkerRef = useRef<Marker | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [marker, setMarker] = useState<Marker | null>(null);

  useEffect(() => {
    mapHook.map.map.setPitch(0);
    const _maxPitch = mapHook.map.map.getMaxPitch();
    mapHook.map.map.setMaxPitch(0);
    return () => {
      initializedRef.current = false;
      maplibreMarkerRef.current?.remove();
      containerRef.current?.remove();
      mapHook.map?.map.setMaxPitch(_maxPitch);
    };
  }, []);

  // Initialize the component when the map is available
  useEffect(() => {
    if (
      !mapHook.map ||
      initializedRef.current ||
      !bbox ||
      bbox.geometry.type !== "Polygon"
    )
      return;
    initializedRef.current = true;
    // Create container for the marker
    containerRef.current = document.createElement("div");

    // Initialize the MapLibre marker - using top-left as anchor point
    const maplibreMarker = new Marker({
      element: containerRef.current,
      anchor: "top-left",
    });

    const coords = bbox.geometry.coordinates[0];
    const [topLeftLng, topLeftLat] = coords[0];
    const [topRightLng, topRightLat] = coords[1];
    const [bottomLeftLng, bottomLeftLat] = coords[3];

    const topLeftPixel = mapHook.map.map.project([topLeftLng, topLeftLat]);
    const topRightPixel = mapHook.map.map.project([topRightLng, topRightLat]);
    const bottomLeftPixel = mapHook.map.map.project([
      bottomLeftLng,
      bottomLeftLat,
    ]);

    const topLeftPixelX = topLeftPixel.x;
    const topLeftPixelY = topLeftPixel.y;
    const _width = Math.round(Math.abs(topRightPixel.x - topLeftPixelX));
    const _height = Math.round(Math.abs(bottomLeftPixel.y - topLeftPixelY));

    // Convert top-left pixel coordinates to geographic coordinates
    const topLeftLngLat = mapHook.map.map.unproject([
      topLeftPixelX,
      topLeftPixelY,
    ]);

    // Position the marker at the top-left corner
    maplibreMarker.setLngLat(topLeftLngLat);
    maplibreMarker.addTo(mapHook.map.map);
    maplibreMarkerRef.current = maplibreMarker;
    setMarker(maplibreMarker);

    // More robust function to update dimensions with retry mechanism
    const updateTargetDimensions = (retryCount = 0, maxRetries = 10) => {
      // Only proceed if component is still mounted

      if (targetRef.current) {
        targetRef.current.style.width = _width + "px";
        targetRef.current.style.height = _height + "px";
        moveableRef.current?.updateRect();
      } else if (retryCount < maxRetries) {
        // Retry with exponential backoff (100ms, 200ms, 300ms, etc.)
        setTimeout(
          () => {
            updateTargetDimensions(retryCount + 1, maxRetries);
          },
          100 + retryCount * 100
        );
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to initialize targetRef after maximum retries");
      }
    };
    moveableRef.current?.updateRect();

    // Start the update process
    updateTargetDimensions();
  }, [mapHook.map, bbox]);

  const updateBbox = useCallback(() => {
    if (!mapHook.map) return;

    if (targetRef.current) {
      //moveableRef.current?.updateRect();

      // Get the map container and target element positions
      const mapContainer = mapHook.map.map.getContainer();
      const mapRect = mapContainer.getBoundingClientRect();
      const targetRect = targetRef.current.getBoundingClientRect();

      // Use the actual scaled dimensions from getBoundingClientRect
      const actualWidth = targetRect.width;
      const actualHeight = targetRect.height;

      // Calculate the pixel coordinates for all corners relative to the map
      const topLeftX = targetRect.left - mapRect.left;
      const topLeftY = targetRect.top - mapRect.top;
      const topRightPixelX = topLeftX + actualWidth;
      const topRightPixelY = topLeftY;
      const bottomLeftPixelX = topLeftX;
      const bottomLeftPixelY = topLeftY + actualHeight;
      const bottomRightPixelX = topLeftX + actualWidth;
      const bottomRightPixelY = topLeftY + actualHeight;

      // Convert all corner points to geographical coordinates using unproject
      const topLeft = mapHook.map.map.unproject([topLeftX, topLeftY]);
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
        bbox: [topLeft.lng, topLeft.lat, bottomRight.lng, bottomRight.lat],
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [topLeft.lng, topLeft.lat],
              [topRight.lng, topRight.lat],
              [bottomRight.lng, bottomRight.lat],
              [bottomLeft.lng, bottomLeft.lat],
              [topLeft.lng, topLeft.lat],
            ],
          ],
        },
        properties: {
          description: "click to edit",
        },
      } as Feature;

      onBboxUpdate(_geoJson);
    }
  }, [mapHook.map, onBboxUpdate]);

  // Render the moveable component
  if (!containerRef.current) return null;

  return ReactDOM.createPortal(
    <>
      <div className="target" ref={targetRef}></div>
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
        edge={true}
        controlPadding={20}
      />
    </>,
    containerRef.current
  );
};

export default BboxSelectorEditMode;
