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
import {
  useMap,
  useMapState,
  MlGeoJsonLayer,
} from "@mapcomponents/react-maplibre";
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

let lastViewPortState = "";

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
  const mapState = useMapState({
    mapId: props.mapId,
    watch: { viewport: true, sources: false, layers: false },
  });
  const [mode, setMode] = useState<"view" | "edit">("view");
  const modeRef = useRef<"view" | "edit">("view");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [bbox, setBbox] = useState<Feature | undefined>(undefined);
  const [marker, setMarker] = useState<Marker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Add isMounted ref at the component level
  const isMounted = useRef(true);

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

  // Switch back to view mode when map state changes
  useEffect(() => {
    const currentViewportState = JSON.stringify(mapState.viewport);
    setMode((curr) => {
      console.log(
        curr,
        currentViewportState === lastViewPortState,
        currentViewportState,
        lastViewPortState
      );
      if (
        modeRef.current === "view" ||
        currentViewportState === lastViewPortState
      ) {
        lastViewPortState = currentViewportState;
        console.log("leave mode on " + curr);
        return modeRef.current;
      }
      lastViewPortState = currentViewportState;
      console.log("switch to view mode");
      modeRef.current = "view";
      return "view";
    });
  }, [mapState.viewport]);

  // Initialize the component when the map is available
  useEffect(() => {
    if (!mapHook.map || mode !== "edit") return;

    // Create container for the marker
    containerRef.current = document.createElement("div");

    // Initialize the MapLibre marker - using top-left as anchor point
    const maplibreMarker = new Marker({
      element: containerRef.current,
      anchor: "top-left",
    });

    if (!mapHook.map || !bbox || bbox.geometry.type !== "Polygon") return;
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
    setMarker(maplibreMarker);

    mapHook.map.map.setPitch(0);
    const _maxPitch = mapHook.map.map.getMaxPitch();
    mapHook.map.map.setMaxPitch(0);

    // More robust function to update dimensions with retry mechanism
    const updateTargetDimensions = (retryCount = 0, maxRetries = 10) => {
      // Only proceed if component is still mounted
      if (!isMounted.current) return;

      if (targetRef.current && !targetRef.current.style.width) {
        targetRef.current.style.width = _width + "px";
        targetRef.current.style.height = _height + "px";
        //targetRef.current.style.left = topLeftPixelX + "px";
        //targetRef.current.style.top = topLeftPixelY + "px";
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

    return () => {
      maplibreMarker.remove();
      containerRef.current?.remove();
      mapHook.map?.map.setMaxPitch(_maxPitch);
    };
  }, [mapHook.map, mode, bbox]);

  const updateBbox = React.useCallback(() => {
    if (!mapHook.map) return;

    if (targetRef.current && mode === "edit") {
      moveableRef.current?.updateRect();

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

      // Update the marker position to match the calculated top-left corner
      //if (marker) {
      //  marker.setLngLat(topLeft);
      //}

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
      } as Feature;

      setBbox(_geoJson);
    }
  }, [mapHook.map, marker, mode, props.options.width, props.options.height]);

  useEffect(() => {
    if (!mapHook.map || bbox) return;

    // Create a default bbox in the center using pixel coordinates
    // Get the map container dimensions
    const container = mapHook.map.map.getContainer();
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;

    // Define a default pixel width and height (adjusted for zoom level)
    const defaultWidth = props.options.width || 100;
    const defaultHeight = props.options.height || 100;

    // Calculate pixel coordinates for corners
    const topLeftPixelX = centerX - defaultWidth / 2;
    const topLeftPixelY = centerY - defaultHeight / 2;
    const topRightPixelX = centerX + defaultWidth / 2;
    const topRightPixelY = centerY - defaultHeight / 2;
    const bottomRightPixelX = centerX + defaultWidth / 2;
    const bottomRightPixelY = centerY + defaultHeight / 2;
    const bottomLeftPixelX = centerX - defaultWidth / 2;
    const bottomLeftPixelY = centerY + defaultHeight / 2;

    // Convert pixel coordinates to geographical coordinates using unproject
    const topLeft = mapHook.map.map.unproject([topLeftPixelX, topLeftPixelY]);
    const topRight = mapHook.map.map.unproject([
      topRightPixelX,
      topRightPixelY,
    ]);
    const bottomRight = mapHook.map.map.unproject([
      bottomRightPixelX,
      bottomRightPixelY,
    ]);
    const bottomLeft = mapHook.map.map.unproject([
      bottomLeftPixelX,
      bottomLeftPixelY,
    ]);

    // Create GeoJSON feature from unprojected coordinates
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
    } as Feature;
    setBbox(_geoJson);
  }, [mapHook.map]);

  const handleBboxClick = () => {
    modeRef.current = "edit";
    setMode("edit");
  };

  // Render the GeoJSON layer in view mode
  const renderViewMode = () => {
    if (!bbox) return null;

    return (
      <MlGeoJsonLayer
        geojson={bbox}
        layerId="bbox-selector-layer"
        mapId={props.mapId}
        onClick={handleBboxClick}
      />
    );
  };

  // Render the moveable component in edit mode
  const renderEditMode = () => {
    // Prevent rendering the portal if containerRef.current is not available
    if (!containerRef.current) return null;

    return ReactDOM.createPortal(
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
    );
  };

  return (
    <>
      {/* Always render the view mode GeoJSON component */}
      {mode === "view" && bbox && renderViewMode()}

      {/* Render the edit mode Moveable component only when in edit mode */}
      {mode === "edit" && renderEditMode()}
    </>
  );
});

export default BboxSelector;
