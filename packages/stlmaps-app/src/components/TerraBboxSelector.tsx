// filepath: /home/tobi/project/stlmaps/packages/stlmaps-app/src/components/TerraBboxSelector.tsx
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useMap, useMapState } from "@mapcomponents/react-maplibre";
import { Feature, Polygon } from "geojson";
import { TerraDraw, TerraDrawRectangleMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import * as turf from "@turf/turf";
import { Units } from "@turf/turf";
import { LngLatLike, Map as MapLibreGLMap } from "maplibre-gl";

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
   * a state variable containing the current bbox state
   */
  options: BboxSelectorOptions;
  /**
   * setter function to update the current bbox state
   */
  setOptions?: (
    arg1:
      | ((val: BboxSelectorOptions) => BboxSelectorOptions)
      | BboxSelectorOptions
  ) => void;
  /**
   * callback function triggered when the bbox changes
   */
  onChange?: (geojson: Feature) => void;
};

/**
 * TerraBboxSelector component renders a transformable (drag, resize) rectangle on the map 
 * using terradraw to allow users to select a bounding box
 */
const TerraBboxSelector = forwardRef((props: Props, ref) => {
  const [options, setOptions] = useState<BboxSelectorOptions>(props.options);
  const mapState = useMapState({
    mapId: props.mapId,
    watch: { layers: false, viewport: true },
  });
  
  const mapHook = useMap({
    mapId: props.mapId,
  });
  
  const terraDrawRef = useRef<TerraDraw | null>(null);
  const featureIdRef = useRef<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [bbox, setBbox] = useState<Feature | undefined>(undefined);
  const fixedScaleRef = useRef<number | null>(null);
  const initializedRef = useRef<boolean>(false);

  // Debounce onChange function to avoid too frequent updates
  function onChangeDebounced(bbox: Feature, debounceMs = 500) {
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      props.onChange?.(bbox);
    }, debounceMs);
    setDebounceTimer(timer);
  }

  // Trigger onChange when bbox changes
  useEffect(() => {
    if (bbox) {
      onChangeDebounced(bbox);
    }
  }, [bbox]);

  // Update props.options when local options change
  useEffect(() => {
    if (typeof props.setOptions === "function") {
      props.setOptions(options);
    }
  }, [options, props]);

  // Initialize TerraDraw when the map is available
  useEffect(() => {
    if (!mapHook.map) return;

    // Set map pitch to 0 and prevent changing it
    mapHook.map.map.setPitch(0);
    const _maxPitch = mapHook.map.map.getMaxPitch();
    mapHook.map.map.setMaxPitch(0);
    
    // Initialize TerraDraw with the MapLibre adapter
    terraDrawRef.current = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ 
        map: mapHook.map.map, 
      }),
      modes: [new TerraDrawRectangleMode()],
    });

    // Start the drawing tool
    terraDrawRef.current.start();
    
    // Add event listeners for terradraw events
    terraDrawRef.current.on("create", (feature) => {
      if (featureIdRef.current) {
        terraDrawRef.current?.deleteFeature(featureIdRef.current);
      }
      featureIdRef.current = feature.id;
      updateOptionsFromFeature(feature);
    });

    terraDrawRef.current.on("update", (feature) => {
      updateOptionsFromFeature(feature);
    });

    // Enable rectangle mode by default
    terraDrawRef.current.setMode("rectangle");
    
    // Create initial rectangle if topLeft and dimensions are provided
    if (options.topLeft && options.width && options.height) {
      createRectangleFromOptions();
    } else {
      // Set default values
      const _centerX = Math.round(mapHook.map.map._container.clientWidth / 2);
      const _centerY = Math.round(mapHook.map.map._container.clientHeight / 2);
      const _center = mapHook.map.map.unproject([_centerX, _centerY]);

      const bbox_size = Math.min(_centerX, _centerY) * 0.5;

      // Calculate default scale based on map zoom
      const defaultScale = 1;
      
      // Set default options
      setOptions((val) => ({
        ...val,
        scale: [defaultScale, defaultScale],
        width: bbox_size,
        height: bbox_size,
        topLeft: [_center.lng - bbox_size / 2, _center.lat - bbox_size / 2],
        rotate: 0,
      }));

      // Create the default rectangle once options are set
      setTimeout(() => {
        createRectangleFromOptions();
      }, 100);
    }

    initializedRef.current = true;

    return () => {
      if (terraDrawRef.current) {
        terraDrawRef.current.destroy();
      }
      mapHook.map?.map.setMaxPitch(_maxPitch);
    };
  }, [mapHook.map]);

  // Update rectangle when options change
  useEffect(() => {
    if (initializedRef.current && terraDrawRef.current && mapHook.map && options.topLeft) {
      createRectangleFromOptions();
    }
  }, [options.topLeft, options.width, options.height, mapHook.map]);

  // Function to create a rectangle from current options
  const createRectangleFromOptions = () => {
    if (!terraDrawRef.current || !mapHook.map || !options.topLeft) return;

    // Calculate all corners of the rectangle using the topLeft coordinate and dimensions
    const topLeftLngLat = options.topLeft;
    const topLeftPixel = mapHook.map.map.project(topLeftLngLat as LngLatLike);
    
    const topRightPixel = { x: topLeftPixel.x + options.width, y: topLeftPixel.y };
    const bottomRightPixel = { x: topLeftPixel.x + options.width, y: topLeftPixel.y + options.height };
    const bottomLeftPixel = { x: topLeftPixel.x, y: topLeftPixel.y + options.height };
    
    const topRight = mapHook.map.map.unproject(topRightPixel);
    const bottomRight = mapHook.map.map.unproject(bottomRightPixel);
    const bottomLeft = mapHook.map.map.unproject(bottomLeftPixel);

    // Create polygon feature for the rectangle
    const polygonFeature: Feature<Polygon> = {
      type: "Feature",
      properties: {
        mode: "rectangle" // Important: this property is used by terra-draw to identify the mode
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [topLeftLngLat[0], topLeftLngLat[1]],
            [topRight.lng, topRight.lat],
            [bottomRight.lng, bottomRight.lat],
            [bottomLeft.lng, bottomLeft.lat],
            [topLeftLngLat[0], topLeftLngLat[1]], // Close the polygon
          ],
        ],
      },
    };

    // If there's already a feature, delete it before adding a new one
    if (featureIdRef.current) {
      terraDrawRef.current.deleteFeature(featureIdRef.current);
    }

    // Add the new rectangle to terradraw
    const result = terraDrawRef.current.addFeatures([polygonFeature]);
    if (result[0].valid && result[0].id) {
      featureIdRef.current = result[0].id;
      
      // Enable editing for the feature
      terraDrawRef.current.selectFeature(result[0].id);

      // Update the bbox state with the new feature
      setBbox(polygonFeature);
    }
  };

  // Function to update options based on a terradraw feature
  const updateOptionsFromFeature = (feature: Feature) => {
    if (!mapHook.map || !feature.geometry) return;

    // Get the coordinates from the polygon feature
    const coordinates = (feature.geometry as Polygon).coordinates[0];
    if (coordinates.length < 5) return; // Ensure we have a complete polygon

    // Extract the corners (topLeft, topRight, bottomRight, bottomLeft)
    const topLeft = coordinates[0];
    const topRight = coordinates[1];
    const bottomRight = coordinates[2];
    const bottomLeft = coordinates[3];

    // Calculate width and height in pixels
    const topLeftPixel = mapHook.map.map.project(topLeft as LngLatLike);
    const topRightPixel = mapHook.map.map.project(topRight as LngLatLike);
    const bottomRightPixel = mapHook.map.map.project(bottomRight as LngLatLike);
    
    const width = Math.round(Math.sqrt(
      Math.pow(topRightPixel.x - topLeftPixel.x, 2) + 
      Math.pow(topRightPixel.y - topLeftPixel.y, 2)
    ));
    const height = Math.round(Math.sqrt(
      Math.pow(bottomRightPixel.x - topRightPixel.x, 2) + 
      Math.pow(bottomRightPixel.y - topRightPixel.y, 2)
    ));

    // Calculate scale (maintaining compatibility with BboxSelector)
    const centerPixelX = (topLeftPixel.x + bottomRightPixel.x) / 2;
    const centerPixelY = (topLeftPixel.y + bottomRightPixel.y) / 2;
    const defaultScale = 1;

    // Update options with new values
    setOptions((val) => ({
      ...val,
      topLeft: [topLeft[0], topLeft[1]],
      width,
      height,
      scale: [defaultScale, defaultScale],
      rotate: 0, // terradraw rectangle tool doesn't support rotation yet
    }));

    // Update the bbox state with the new feature
    setBbox(feature);
  };

  // Function to manually update the bbox (exposed via ref)
  const updateBbox = () => {
    if (terraDrawRef.current && featureIdRef.current) {
      const feature = terraDrawRef.current.getFeature(featureIdRef.current);
      if (feature) {
        updateOptionsFromFeature(feature);
      }
    }
  };

  // Expose updateBbox method through ref
  useImperativeHandle(ref, () => ({
    updateBbox
  }));

  return null; // TerraBboxSelector doesn't render any UI elements directly
});

export default TerraBboxSelector;
