import * as THREE from 'three';
import { VtDataSet } from '../components/GenerateMeshButton';

export const vtGeometries: VtDataSet[] = [
    {
        sourceLayer: "water",
        color: new THREE.Color(0x76bcff), // Lighter blue color for water
        extrusionDepth: 1, // Thin extrusion for water
        zOffset: -0.5,
        enabled: true,
    },
    {
        sourceLayer: "landcover",
        color: new THREE.Color(0x74e010), // Green color for landuse
        extrusionDepth: 1.2, // Thin extrusion for landuse
        zOffset: -0.3,
        bufferSize: 2,
        enabled: true,
    },
    {
        sourceLayer: "park",
        color: new THREE.Color(0x4CDF54), // Green color for landuse
        extrusionDepth: 0.8, // Thin extrusion for landuse
        zOffset: -0.3,
        bufferSize: 2,
        enabled: true,
    },
    {
        sourceLayer: "landuse",
        color: new THREE.Color(0x4CAF50), // Green color for landuse
        extrusionDepth: 0.8, // Thin extrusion for landuse
        zOffset: -0.4,
        bufferSize: 2,
        enabled: true,
        // Filter to include green areas
        filter: [
            "in",
            "class",
            "commercial",
            "residential",
        ]
    },
    {
        sourceLayer: "transportation",
        color: new THREE.Color(0x989898), // Gray color for streets
        extrusionDepth: 0.8, // Thin extrusion for landuse
        zOffset: -0.2,
        bufferSize: 2.4,
        enabled: true,
        alignVerticesToTerrain: false,
        // Updated filter to include more street types
        filter: [
            "all",
            ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "residential", "service", "minor", "track"],
        ]
    },
    {
        sourceLayer: "building",
        color: new THREE.Color(0xafafaf), // Gray color for buildings
        zOffset: 0,
        useAdaptiveScaleFactor: true,
        heightScaleFactor: 0.4,
        enabled: true,
    },
];