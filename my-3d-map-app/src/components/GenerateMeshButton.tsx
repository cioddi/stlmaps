import { useState, Suspense, RefObject, ChangeEvent } from "react";
import {
  Button,
  CircularProgress,
  Slider,
  Typography,
  Box,
} from "@mui/material";
import ModelPreview from "./ModelPreview";
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

// Define interfaces for our data structures
interface GridSize {
  width: number;
  height: number;
}

interface Tile {
  x: number;
  y: number;
  z: number;
}

interface TileData {
  imageData?: ImageData;
  width: number;
  height: number;
  x: number;
  y: number;
  z: number;
}

interface GeoJSONFeature {
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties?: Record<string, any>;
  type: string;
}

interface ElevationProcessingResult {
  elevationGrid: number[][];
  gridSize: GridSize;
}

interface GenerateMeshButtonProps {
  bboxRef: RefObject<GeoJSONFeature>;
}

// Add new interfaces for building data
interface BuildingFeature {
  geometry: {
    coordinates: number[][][];  // Polygon coordinates
    type: string;
  };
  properties: {
    render_height?: number;  // Height data
    height?: number;         // Alternative height property
  };
}

interface BuildingData {
  footprint: number[][];  // Simplified to single polygon ring
  height: number;
  baseElevation: number;  // Elevation at building position
}

export const GenerateMeshButton = function ({
  bboxRef,
}: GenerateMeshButtonProps) {
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [objData, setObjData] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [verticalExaggeration, setVerticalExaggeration] =
    useState<number>(0.00006);

  // Generate an OBJ file from the elevation grid
  const generateObjFromElevation = (
    elevationGrid: number[][],
    gridSize: GridSize,
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
  ): string => {
    let objContent = "# OBJ file generated from elevation data\n";
    objContent +=
      "# Bounds: " + [minLng, minLat, maxLng, maxLat].join(", ") + "\n";

    // Add vertices for top surface
    const { width, height } = gridSize;
    const scaleX = (maxLng - minLng) / (width - 1);
    const scaleY = (maxLat - minLat) / (height - 1);

    // Find min elevation for base
    let minElevation = Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        minElevation = Math.min(minElevation, elevationGrid[y][x]);
      }
    }

    // Set base elevation to be a fixed distance below the minimum elevation
    const baseOffset = 100; // meters below the minimum elevation
    const baseElevation = (minElevation - baseOffset) * verticalExaggeration;

    // Add top surface vertices
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lng = minLng + x * scaleX;
        const lat = minLat + y * scaleY;
        const elevation = elevationGrid[y][x] * verticalExaggeration;

        // OBJ format: v x y z
        objContent += `v ${lng} ${lat} ${elevation}\n`;
      }
    }

    // Add bottom surface vertices
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const lng = minLng + x * scaleX;
        const lat = minLat + y * scaleY;

        // OBJ format: v x y z
        objContent += `v ${lng} ${lat} ${baseElevation}\n`;
      }
    }

    // Calculate total number of vertices per layer
    const verticesPerLayer = width * height;

    // Add faces for top surface
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const topLeft = y * width + x + 1; // +1 because OBJ indices start at 1
        const topRight = topLeft + 1;
        const bottomLeft = (y + 1) * width + x + 1;
        const bottomRight = bottomLeft + 1;

        // Two triangles per grid cell for the top surface
        objContent += `f ${topLeft} ${topRight} ${bottomLeft}\n`;
        objContent += `f ${bottomLeft} ${topRight} ${bottomRight}\n`;
      }
    }

    // Add faces for bottom surface
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const topLeft = y * width + x + 1 + verticesPerLayer;
        const topRight = topLeft + 1;
        const bottomLeft = (y + 1) * width + x + 1 + verticesPerLayer;
        const bottomRight = bottomLeft + 1;

        // Two triangles per grid cell for the bottom (inverted)
        objContent += `f ${topLeft} ${bottomLeft} ${topRight}\n`;
        objContent += `f ${topRight} ${bottomLeft} ${bottomRight}\n`;
      }
    }

    // Add side walls with consistent winding order - FIXED NORMALS
    // Front edge (y=0)
    for (let x = 0; x < width - 1; x++) {
      const topLeft = x + 1;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + verticesPerLayer;
      const bottomRight = topRight + verticesPerLayer;

      // Reversed winding order for correct outward-facing normals
      objContent += `f ${topRight} ${topLeft} ${bottomRight}\n`;
      objContent += `f ${bottomRight} ${topLeft} ${bottomLeft}\n`;
    }

    // Back edge (y=height-1)
    for (let x = 0; x < width - 1; x++) {
      const topLeft = (height - 1) * width + x + 1;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + verticesPerLayer;
      const bottomRight = topRight + verticesPerLayer;

      // Reversed winding order for correct outward-facing normals
      objContent += `f ${topLeft} ${topRight} ${bottomLeft}\n`;
      objContent += `f ${bottomLeft} ${topRight} ${bottomRight}\n`;
    }

    // Left edge (x=0)
    for (let y = 0; y < height - 1; y++) {
      const topLeft = y * width + 1;
      const bottomLeft = (y + 1) * width + 1;
      const topLeftBottom = topLeft + verticesPerLayer;
      const bottomLeftBottom = bottomLeft + verticesPerLayer;

      // Reversed winding order for correct outward-facing normals
      objContent += `f ${topLeft} ${bottomLeft} ${topLeftBottom}\n`;
      objContent += `f ${topLeftBottom} ${bottomLeft} ${bottomLeftBottom}\n`;
    }

    // Right edge (x=width-1)
    for (let y = 0; y < height - 1; y++) {
      const topRight = y * width + width;
      const bottomRight = (y + 1) * width + width;
      const topRightBottom = topRight + verticesPerLayer;
      const bottomRightBottom = bottomRight + verticesPerLayer;

      // Reversed winding order for correct outward-facing normals
      objContent += `f ${bottomRight} ${topRight} ${bottomRightBottom}\n`;
      objContent += `f ${bottomRightBottom} ${topRight} ${topRightBottom}\n`;
    }

    return objContent;
  };

// Modify generate3DModel function to include buildings
const generate3DModel = async (): Promise<void> => {
  if (!bboxRef.current) return;
  console.log("Generating 3D model for:", bboxRef.current);
  setGenerating(true);

  try {
    // Extract bbox coordinates from the feature
    const feature = bboxRef.current;

    if (!feature.geometry || feature.geometry.type !== "Polygon") {
      console.error("Invalid geometry: expected a Polygon");
      setGenerating(false);
      return;
    }

    const coordinates = feature.geometry.coordinates[0]; // First ring of the polygon

    // Find min/max coordinates
    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity;
    coordinates.forEach((coord: number[]) => {
      const [lng, lat] = coord;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });

    // Find appropriate zoom level where we get at most 4 tiles
    // Start with maximum supported zoom level (12)
    let zoom = 12;
    while (zoom > 0) {
      const tileCount = calculateTileCount(
        minLng,
        minLat,
        maxLng,
        maxLat,
        zoom
      );
      if (tileCount <= 4) break;
      zoom--;
    }

    console.log(`Using zoom level ${zoom} for the 3D model`);

    // Get tile coordinates
    const tiles = getTilesForBbox(minLng, minLat, maxLng, maxLat, zoom);
    console.log(`Downloading ${tiles.length} tiles`);

    // Download tile data
    const tileData = await Promise.all(
      tiles.map((tile) => downloadTile(tile.z, tile.x, tile.y))
    );

    // Process elevation data to create a grid
    const { elevationGrid, gridSize } = processElevationData(
      tileData,
      tiles,
      minLng,
      minLat,
      maxLng,
      maxLat
    );

    // Fetch building data - use zoom level + 2 for buildings to get more detail
    const buildingZoom = Math.min(zoom + 2, 14);
    console.log(`Fetching buildings at zoom level ${buildingZoom}`);
    const buildingFeatures = await fetchBuildingData(
      minLng,
      minLat,
      maxLng,
      maxLat,
      buildingZoom
    );

    // Process building data
    const buildings = processBuildings(
      buildingFeatures,
      elevationGrid,
      gridSize,
      minLng,
      minLat,
      maxLng,
      maxLat
    );

    // Generate OBJ model from elevation grid and buildings
    const objData = generateObjFromElevationWithBuildings(
      elevationGrid,
      gridSize,
      buildings,
      minLng,
      minLat,
      maxLng,
      maxLat
    );

    // Store obj data for preview
    setObjData(objData);

    // Create download
    const blob = new Blob([objData], { type: "text/plain" });
    setDownloadUrl(URL.createObjectURL(blob));
    console.log("3D model generated successfully");

    // Open the preview
    setPreviewOpen(true);
  } catch (error) {
    console.error("Error generating 3D model:", error);
  } finally {
    setGenerating(false);
  }
};

// Function to fetch building data from vector tiles
const fetchBuildingData = async (
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
  zoom: number
): Promise<BuildingFeature[]> => {
  // Get tiles that cover the bounding box
  const tiles = getTilesForBbox(minLng, minLat, maxLng, maxLat, zoom);
  console.log(`Fetching building data from ${tiles.length} tiles`);

  const buildingFeatures: BuildingFeature[] = [];
  
  try {
    // Get the current map style to extract building layer source
    const map = document._map;
    if (!map) {
      console.error("Map instance not found");
      return buildingFeatures;
    }
    
    // Find building source from map style
    const style = map.getStyle();
    let buildingSource = null;
    let buildingSourceLayer = null;
    
    // Find a layer containing buildings
    for (const layerId in style.layers) {
      const layer = style.layers[layerId];
      if (layer.id.toLowerCase().includes('building') || 
          (layer['source-layer'] && layer['source-layer'].toLowerCase().includes('building'))) {
        buildingSource = layer.source;
        buildingSourceLayer = layer['source-layer'];
        break;
      }
    }
    
    if (!buildingSource || !buildingSourceLayer) {
      console.warn("Could not find building source layer in map style");
      // Fallback to OpenMapTiles source
      buildingSource = 'openmaptiles';
      buildingSourceLayer = 'building';
    }
    
    // Get source URL template
    const sourceInfo = style.sources[buildingSource];
    if (!sourceInfo || !sourceInfo.tiles) {
      console.warn("Building source doesn't have tile URLs");
      return buildingFeatures;
    }
    
    const tileUrlTemplate = sourceInfo.tiles[0];
    
    await Promise.all(
      tiles.map(async (tile) => {
        // Replace placeholders in URL template with tile coordinates
        const url = tileUrlTemplate
          .replace('{z}', tile.z.toString())
          .replace('{x}', tile.x.toString())
          .replace('{y}', tile.y.toString());
        
        console.log(`Fetching buildings from: ${url}`);
        
        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            console.warn(`Failed to fetch building tile: ${response.status}`);
            return;
          }
          
          const arrayBuffer = await response.arrayBuffer();
          
          // Parse MVT tile
          const vectorTile = parseVectorTile(arrayBuffer);
          
          // Extract building features
          const buildings = extractBuildingsFromVectorTile(
            vectorTile,
            tile,
            buildingSourceLayer
          );
          
          // Add to collection
          buildingFeatures.push(...buildings);
        } catch (error) {
          console.error(`Error fetching building tile ${tile.z}/${tile.x}/${tile.y}:`, error);
        }
      })
    );
    
    console.log(`Found ${buildingFeatures.length} buildings`);
    return buildingFeatures;
  } catch (error) {
    console.error("Error fetching building data:", error);
    return [];
  }
};

// Function to parse MVT
const parseVectorTile = (arrayBuffer: ArrayBuffer): any => {
  try {
    // Create a vector tile from the buffer
    const pbf = new Pbf(arrayBuffer);
    const vectorTile = new VectorTile(pbf);
    return vectorTile;
  } catch (error) {
    console.error("Error parsing vector tile:", error);
    return {};
  }
};

// Function to extract buildings from vector tile
const extractBuildingsFromVectorTile = (
  vectorTile: any, 
  tile: Tile, 
  sourceLayer: string
): BuildingFeature[] => {
  const features: BuildingFeature[] = [];
  
  try {
    // Check if the tile has the building layer
    if (!vectorTile.layers || !vectorTile.layers[sourceLayer]) {
      return features;
    }
    
    const buildingLayer = vectorTile.layers[sourceLayer];
    const tileSize = 4096; // Standard MVT tile size
    
    // Iterate through building features in this layer
    for (let i = 0; i < buildingLayer.length; i++) {
      const feature = buildingLayer.feature(i);
      const geomType = feature.type;
      
      // We only want polygons for buildings
      if (geomType !== 3) continue;
      
      // Get the geometry as GeoJSON
      const geojson = feature.toGeoJSON(tile.x, tile.y, tile.z);
      
      // Only process if we have polygon geometry
      if (geojson.geometry.type !== 'Polygon' && geojson.geometry.type !== 'MultiPolygon') {
        continue;
      }
      
      // For MultiPolygon, we treat each polygon as a separate building
      if (geojson.geometry.type === 'MultiPolygon') {
        geojson.geometry.coordinates.forEach(polygonCoords => {
          features.push({
            geometry: {
              type: 'Polygon',
              coordinates: polygonCoords
            },
            properties: {
              render_height: feature.properties.render_height || feature.properties.height,
              height: feature.properties.height || feature.properties.render_height || 5
            }
          });
        });
      } else {
        // Single polygon
        features.push({
          geometry: {
            type: 'Polygon',
            coordinates: geojson.geometry.coordinates
          },
          properties: {
            render_height: feature.properties.render_height || feature.properties.height,
            height: feature.properties.height || feature.properties.render_height || 5
          }
        });
      }
    }
    
    return features;
  } catch (error) {
    console.error("Error extracting buildings from vector tile:", error);
    return [];
  }
};

// Alternative implementation for direct building fetch if the map instance doesn't expose the needed APIs
const fetchBuildingDataDirect = async (
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
  zoom: number
): Promise<BuildingFeature[]> => {
  // Get tiles that cover the bounding box
  const tiles = getTilesForBbox(minLng, minLat, maxLng, maxLat, zoom);
  console.log(`Fetching building data from ${tiles.length} tiles using direct method`);

  const buildingFeatures: BuildingFeature[] = [];
  
  try {
    // Use OpenMapTiles or OSM vector tile source
    const baseUrl = "https://api.maptiler.com/tiles/v3";
    const apiKey = "YOUR_API_KEY"; // Replace with your actual API key or get from environment
    
    await Promise.all(
      tiles.map(async (tile) => {
        const url = `${baseUrl}/${tile.z}/${tile.x}/${tile.y}.pbf?key=${apiKey}`;
        
        console.log(`Fetching buildings from: ${url}`);
        
        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            console.warn(`Failed to fetch building tile: ${response.status}`);
            return;
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const vectorTile = parseVectorTile(arrayBuffer);
          
          // Building layer name in OpenMapTiles
          const buildings = extractBuildingsFromVectorTile(
            vectorTile,
            tile,
            "building"
          );
          
          // Add to collection
          buildingFeatures.push(...buildings);
        } catch (error) {
          console.error(`Error fetching building tile ${tile.z}/${tile.x}/${tile.y}:`, error);
        }
      })
    );
    
    console.log(`Found ${buildingFeatures.length} buildings`);
    return buildingFeatures;
  } catch (error) {
    console.error("Error fetching building data:", error);
    return [];
  }
};

// Process building data to map to the terrain
const processBuildings = (
  buildingFeatures: BuildingFeature[],
  elevationGrid: number[][],
  gridSize: GridSize,
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number
): BuildingData[] => {
  const buildings: BuildingData[] = [];
  const { width, height } = gridSize;
  
  buildingFeatures.forEach((feature) => {
    if (feature.geometry.type !== "Polygon") return;
    
    // Get the building footprint (first ring of the polygon)
    const footprint = feature.geometry.coordinates[0];
    
    // Check if the building is within our bounds
    let isInBounds = false;
    for (const point of footprint) {
      const [lng, lat] = point;
      if (
        lng >= minLng && lng <= maxLng &&
        lat >= minLat && lat <= maxLat
      ) {
        isInBounds = true;
        break;
      }
    }
    
    if (!isInBounds) return;
    
    // Get building height from properties
    let buildingHeight = feature.properties.render_height || feature.properties.height || 5; // Default 5m
    
    // Get base elevation by sampling the elevation at the center of the building
    const centroid = calculateCentroid(footprint);
    const [centroidLng, centroidLat] = centroid;
    
    // Convert to grid coordinates
    const gridX = Math.floor(((centroidLng - minLng) / (maxLng - minLng)) * (width - 1));
    const gridY = Math.floor(((centroidLat - minLat) / (maxLat - minLat)) * (height - 1));
    
    // Get base elevation from the grid (with bounds checking)
    let baseElevation = 0;
    if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
      baseElevation = elevationGrid[gridY][gridX];
    } else {
      // If out of bounds, approximate based on nearby points
      const nearestX = Math.max(0, Math.min(width - 1, gridX));
      const nearestY = Math.max(0, Math.min(height - 1, gridY));
      baseElevation = elevationGrid[nearestY][nearestX];
    }
    
    // Add the building with its height and base elevation
    buildings.push({
      footprint,
      height: buildingHeight,
      baseElevation
    });
  });
  
  console.log(`Processed ${buildings.length} buildings for 3D model`);
  return buildings;
};

// Helper to calculate centroid of a polygon
const calculateCentroid = (points: number[][]): number[] => {
  let sumX = 0;
  let sumY = 0;
  
  for (const point of points) {
    sumX += point[0];
    sumY += point[1];
  }
  
  return [sumX / points.length, sumY / points.length];
};

// Generate OBJ with buildings
const generateObjFromElevationWithBuildings = (
  elevationGrid: number[][],
  gridSize: GridSize,
  buildings: BuildingData[],
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number
): string => {
  // Start with the terrain
  const objContent = generateObjFromElevation(
    elevationGrid,
    gridSize,
    minLng,
    minLat,
    maxLng,
    maxLat
  );
  
  // If no buildings, return just the terrain
  if (buildings.length === 0) {
    return objContent;
  }
  
  // Count vertices in the terrain to know the offset
  const terrainVertexCount = countVerticesInObj(objContent);
  
  // Add buildings to the OBJ content
  let buildingsObjContent = "\n# Building models\n";
  
  buildings.forEach((building, index) => {
    buildingsObjContent += `# Building ${index + 1}\n`;
    buildingsObjContent += generateBuildingObj(
      building,
      terrainVertexCount + getBuildingVertexOffset(buildings, index),
      verticalExaggeration
    );
  });
  
  return objContent + buildingsObjContent;
};

// Count vertices in OBJ content
const countVerticesInObj = (objContent: string): number => {
  const lines = objContent.split('\n');
  let count = 0;
  
  for (const line of lines) {
    if (line.startsWith('v ')) {
      count++;
    }
  }
  
  return count;
};

// Calculate vertex offset for a building
const getBuildingVertexOffset = (buildings: BuildingData[], currentIndex: number): number => {
  let offset = 0;
  
  for (let i = 0; i < currentIndex; i++) {
    // Each building adds vertices for its footprint (top + bottom) and walls
    const footprintPoints = buildings[i].footprint.length;
    offset += footprintPoints * 2 + footprintPoints * 2; // Top + bottom + walls
  }
  
  return offset;
};

// Generate OBJ content for a building
const generateBuildingObj = (
  building: BuildingData,
  vertexOffset: number,
  verticalExaggeration: number
): string => {
  let objContent = '';
  const { footprint, height, baseElevation } = building;
  
  // Calculate exaggerated heights
  const baseZ = baseElevation * verticalExaggeration;
  const topZ = baseZ + height * verticalExaggeration;
  
  // Add vertices for the top of the building
  for (const point of footprint) {
    const [lng, lat] = point;
    objContent += `v ${lng} ${lat} ${topZ}\n`;
  }
  
  // Add vertices for the bottom of the building
  for (const point of footprint) {
    const [lng, lat] = point;
    objContent += `v ${lng} ${lat} ${baseZ}\n`;
  }
  
  const footprintSize = footprint.length;
  
  // Add the top face (ccw for correct normals)
  objContent += "f";
  for (let i = 0; i < footprintSize; i++) {
    objContent += ` ${vertexOffset + i + 1}`;
  }
  objContent += "\n";
  
  // Add the bottom face (cw for correct normals)
  objContent += "f";
  for (let i = footprintSize - 1; i >= 0; i--) {
    objContent += ` ${vertexOffset + footprintSize + i + 1}`;
  }
  objContent += "\n";
  
  // Add the side faces (walls)
  for (let i = 0; i < footprintSize; i++) {
    const nextI = (i + 1) % footprintSize;
    
    // Define the four corners of this wall face
    const topLeft = vertexOffset + i + 1;
    const topRight = vertexOffset + nextI + 1;
    const bottomLeft = vertexOffset + footprintSize + i + 1;
    const bottomRight = vertexOffset + footprintSize + nextI + 1;
    
    // Create two triangles for the wall face
    objContent += `f ${topLeft} ${bottomLeft} ${topRight}\n`;
    objContent += `f ${topRight} ${bottomLeft} ${bottomRight}\n`;
  }
  
  return objContent;
};

  // Helper function to calculate the number of tiles at a given zoom level
  const calculateTileCount = (
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    zoom: number
  ): number => {
    const minTile = lngLatToTile(minLng, minLat, zoom);
    const maxTile = lngLatToTile(maxLng, maxLat, zoom);

    const width = Math.abs(maxTile.x - minTile.x) + 1;
    const height = Math.abs(maxTile.y - minTile.y) + 1;

    return width * height;
  };

  // Convert lng/lat to tile coordinates
  const lngLatToTile = (
    lng: number,
    lat: number,
    zoom: number
  ): { x: number; y: number } => {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);

    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
        n
    );

    return { x, y };
  };

  // Get all tiles that cover the bounding box
  const getTilesForBbox = (
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    zoom: number
  ): Tile[] => {
    const minTile = lngLatToTile(minLng, minLat, zoom);
    const maxTile = lngLatToTile(maxLng, maxLat, zoom);

    const tiles: Tile[] = [];

    for (
      let x = Math.min(minTile.x, maxTile.x);
      x <= Math.max(minTile.x, maxTile.x);
      x++
    ) {
      for (
        let y = Math.min(minTile.y, maxTile.y);
        y <= Math.max(minTile.y, maxTile.y);
        y++
      ) {
        tiles.push({ x, y, z: zoom });
      }
    }

    return tiles;
  };

  // Download a single tile from the WMTS service
  const downloadTile = async (
    z: number,
    x: number,
    y: number
  ): Promise<TileData> => {
    const url = `https://wms.wheregroup.com/dem_tileserver/raster_dem/${z}/${x}/${y}.webp`;

    console.log(`Downloading tile: ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download tile: ${response.status}`);
      }

      // Get the image as blob
      const blob = await response.blob();

      // Use image bitmap for processing
      const imageBitmap = await createImageBitmap(blob);

      // Create a canvas to read pixel data
      const canvas = document.createElement("canvas");
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      ctx.drawImage(imageBitmap, 0, 0);

      // Get the raw pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      return {
        imageData,
        width: canvas.width,
        height: canvas.height,
        x,
        y,
        z,
      };
    } catch (error) {
      console.error(`Error downloading tile ${z}/${x}/${y}:`, error);
      throw error;
    }
  };

  // Process the downloaded tiles to create an elevation grid
  const processElevationData = (
    tileData: TileData[],
    tiles: Tile[],
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
  ): ElevationProcessingResult => {
    // Define grid size for the final model - higher resolution for better quality
    const gridSize: GridSize = { width: 150, height: 150 };

    // Track accumulated elevation values and weights
    const elevationGrid: number[][] = new Array(gridSize.height)
      .fill(0)
      .map(() => new Array(gridSize.width).fill(0));

    const coverageMap: number[][] = new Array(gridSize.height)
      .fill(0)
      .map(() => new Array(gridSize.width).fill(0));

    // Pre-process: Calculate valid elevation range for normalization
    let minElevationFound = Infinity;
    let maxElevationFound = -Infinity;

    tileData.forEach((tile) => {
      if (!tile.imageData) return;
      const { imageData, width, height } = tile;
      const data = imageData.data;

      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const pixelIndex = (py * width + px) * 4;
          const r = data[pixelIndex];
          const g = data[pixelIndex + 1];
          const b = data[pixelIndex + 2];

          // Decode elevation using the RGB encoding
          const elevation = -10000 + (r * 65536 + g * 256 + b) * 0.1;

          if (isFinite(elevation) && !isNaN(elevation)) {
            minElevationFound = Math.min(minElevationFound, elevation);
            maxElevationFound = Math.max(maxElevationFound, elevation);
          }
        }
      }
    });

    console.log(
      `Elevation range: ${minElevationFound.toFixed(
        2
      )}m - ${maxElevationFound.toFixed(2)}m`
    );

    // Process each tile to extract elevation data
    tileData.forEach((tile) => {
      if (!tile.imageData) return;

      const { imageData, width, height, x: tileX, y: tileY, z: zoom } = tile;
      const data = imageData.data;

      // Calculate the tile bounds in geographic coordinates
      const n = Math.pow(2, zoom);
      const tileMinLng = (tileX / n) * 360 - 180;
      const tileMaxLng = ((tileX + 1) / n) * 360 - 180;

      // Note: In web mercator, y=0 is at the top (north pole)
      const tileMaxLat =
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n))) * 180) / Math.PI;
      const tileMinLat =
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 1)) / n))) * 180) /
        Math.PI;

      // For each pixel in our output grid
      for (let y = 0; y < gridSize.height; y++) {
        for (let x = 0; x < gridSize.width; x++) {
          // Calculate the lat/lng for this grid point
          const lng = minLng + (maxLng - minLng) * (x / (gridSize.width - 1));
          const lat = minLat + (maxLat - minLat) * (y / (gridSize.height - 1));

          // Skip if this point is outside the current tile's geographic bounds
          if (
            lng < tileMinLng ||
            lng > tileMaxLng ||
            lat < tileMinLat ||
            lat > tileMaxLat
          ) {
            continue;
          }

          // Convert geographic coordinates to pixel coordinates in the tile
          // For longitude: simple linear mapping from tileMinLng-tileMaxLng to 0-(width-1)
          const fracX =
            ((lng - tileMinLng) / (tileMaxLng - tileMinLng)) * (width - 1);

          // For latitude: account for Mercator projection (y increases downward in the tile image)
          const fracY =
            (1 - (lat - tileMinLat) / (tileMaxLat - tileMinLat)) * (height - 1);

          // Get integer pixel coordinates
          const pixelX = Math.floor(fracX);
          const pixelY = Math.floor(fracY);

          // Constrain to valid pixel coordinates
          if (
            pixelX < 0 ||
            pixelX >= width - 1 ||
            pixelY < 0 ||
            pixelY >= height - 1
          ) {
            continue;
          }

          // Bilinear interpolation factors
          const dx = fracX - pixelX;
          const dy = fracY - pixelY;

          // Sample the 4 surrounding pixels
          const elevations: number[] = [];
          let hasInvalidElevation = false;

          for (let j = 0; j <= 1; j++) {
            for (let i = 0; i <= 1; i++) {
              const px = pixelX + i;
              const py = pixelY + j;

              if (px >= 0 && px < width && py >= 0 && py < height) {
                const pixelIndex = (py * width + px) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];

                // Decode elevation - make sure this matches the encoding used in the DEM tiles
                const elevation = -10000 + (r * 65536 + g * 256 + b) * 0.1;

                if (!isFinite(elevation) || isNaN(elevation)) {
                  hasInvalidElevation = true;
                  break;
                }

                elevations.push(elevation);
              } else {
                hasInvalidElevation = true;
                break;
              }
            }
            if (hasInvalidElevation) break;
          }

          if (hasInvalidElevation || elevations.length !== 4) continue;

          // Bilinear interpolation
          const topLeft = elevations[0];
          const topRight = elevations[1];
          const bottomLeft = elevations[2];
          const bottomRight = elevations[3];

          const top = topLeft * (1 - dx) + topRight * dx;
          const bottom = bottomLeft * (1 - dx) + bottomRight * dx;
          const elevation = top * (1 - dy) + bottom * dy;

          // Calculate edge distance for weighting
          // This creates a weight that's 1.0 in the center and gradually decreases to 0.3 at the edges
          const distFromCenterX = Math.abs(
            2.0 * ((lng - tileMinLng) / (tileMaxLng - tileMinLng) - 0.5)
          );
          const distFromCenterY = Math.abs(
            2.0 * ((lat - tileMinLat) / (tileMaxLat - tileMinLat) - 0.5)
          );
          const maxDist = Math.max(distFromCenterX, distFromCenterY);

          // Smoother falloff at edges - gradient starts earlier
          const edgeWeight = 1.0 - Math.pow(maxDist, 2) * 0.7;

          // Accumulate weighted elevation value
          elevationGrid[y][x] += elevation * edgeWeight;
          coverageMap[y][x] += edgeWeight;
        }
      }
    });

    // Normalize by coverage and ensure we have valid data everywhere
    let missingDataPoints = 0;

    for (let y = 0; y < gridSize.height; y++) {
      for (let x = 0; x < gridSize.width; x++) {
        if (coverageMap[y][x] > 0) {
          elevationGrid[y][x] /= coverageMap[y][x];
        } else {
          missingDataPoints++;

          // Find nearest valid point for missing data
          let nearestValid = null;
          let minDistance = Infinity;

          for (let ny = 0; ny < gridSize.height; ny++) {
            for (let nx = 0; nx < gridSize.width; nx++) {
              if (coverageMap[ny][nx] > 0) {
                const dist = Math.sqrt(
                  Math.pow(nx - x, 2) + Math.pow(ny - y, 2)
                );
                if (dist < minDistance) {
                  minDistance = dist;
                  nearestValid = { x: nx, y: ny };
                }
              }
            }
          }

          if (nearestValid) {
            elevationGrid[y][x] = elevationGrid[nearestValid.y][nearestValid.x];
          } else {
            // Fallback to average if no valid points at all
            elevationGrid[y][x] = (minElevationFound + maxElevationFound) / 2;
          }
        }
      }
    }

    if (missingDataPoints > 0) {
      console.log(`Filled ${missingDataPoints} missing data points`);
    }

    // Apply multiple smoothing passes for better results
    let smoothedGrid = elevationGrid;
    const smoothingPasses = 2;

    for (let i = 0; i < smoothingPasses; i++) {
      smoothedGrid = smoothElevationGrid(smoothedGrid, gridSize);
    }

    return { elevationGrid: smoothedGrid, gridSize };
  };

  // Helper function to smooth the elevation grid
  const smoothElevationGrid = (
    grid: number[][],
    gridSize: GridSize
  ): number[][] => {
    const { width, height } = gridSize;
    const result = new Array(height)
      .fill(0)
      .map(() => new Array(width).fill(0));

    // Larger kernel for better smoothing
    const kernelSize = 5;
    const kernelRadius = Math.floor(kernelSize / 2);

    // Apply a gaussian smoothing kernel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let totalWeight = 0;

        for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
          for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
            const ny = y + ky;
            const nx = x + kx;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              // Gaussian weight based on distance
              const dist = Math.sqrt(kx * kx + ky * ky);
              // Sigma = kernelRadius/2 for a nice falloff
              const weight = Math.exp(
                (-dist * dist) / (2 * kernelRadius * kernelRadius)
              );

              sum += grid[ny][nx] * weight;
              totalWeight += weight;
            }
          }
        }

        if (totalWeight > 0) {
          result[y][x] = sum / totalWeight;
        } else {
          result[y][x] = grid[y][x];
        }
      }
    }

    return result;
  };

  const handleExaggerationChange = (
    event: Event,
    newValue: number | number[]
  ) => {
    setVerticalExaggeration(newValue as number);
  };

  return (
    <>
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          backgroundColor: "rgba(255,255,255,0.8)",
          padding: "10px",
          borderRadius: "4px",
          width: "300px",
        }}
      >
        <Box sx={{ mb: 2 }}>
          <Typography id="vertical-exaggeration-slider" gutterBottom>
            Vertical Exaggeration: {verticalExaggeration.toFixed(6)}
          </Typography>
          <Slider
            value={verticalExaggeration}
            onChange={handleExaggerationChange}
            aria-labelledby="vertical-exaggeration-slider"
            min={0.000001}
            max={0.001}
            step={0.00001}
            marks={[
              { value: 0.000001, label: "Min" },
              { value: 0.0001, label: "Med" },
              { value: 0.001, label: "Max" },
            ]}
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={generate3DModel}
          disabled={generating}
        >
          {generating ? <CircularProgress size={24} /> : "Generate 3D Model"}
        </Button>
        {downloadUrl && (
          <>
            <Button
              variant="outlined"
              style={{ marginLeft: "1rem" }}
              onClick={() => setPreviewOpen(true)}
            >
              Preview
            </Button>
            <Button
              variant="outlined"
              style={{ marginLeft: "1rem" }}
              href={downloadUrl}
              download="model.obj"
            >
              Download OBJ
            </Button>
          </>
        )}
      </div>

      <Suspense fallback={null}>
        {objData && (
          <ModelPreview
            objData={objData}
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </Suspense>
    </>
  );
};
