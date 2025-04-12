import React, { useState, Suspense } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  CssBaseline,
  CircularProgress,
  Box,
  Divider,
} from "@mui/material";
import { MapLibreMap } from "@mapcomponents/react-maplibre";
import ModelPreview from "./components/ModelPreview";
import CitySearch from "./components/CitySearch";
import useLayerStore from "./stores/useLayerStore";
import { Sidebar } from "./components/Sidebar";

const mapCenter: [number, number] = [-74.00599999999997, 40.71279999999999];
const SIDEBAR_WIDTH = 440;

const App: React.FC = () => {
  const [bboxCenter, setBboxCenter] = useState<[number, number]>([
    -74.00599999999997, 40.71279999999999,
  ]);

  // Get layer settings and geometries from Zustand store
  const {
    terrainSettings,
    buildingSettings,
    polygonGeometries,
    terrainGeometry,
    buildingsGeometry
  } = useLayerStore();


  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 10000 }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h6" color="primary">
            STLmaps
          </Typography>
          <CitySearch
            onCitySelect={(city) => {
              if (city) {
                // Only update bbox center, map center is handled by CitySearch component
                setBboxCenter(city.coordinates);
              }
            }}
          />
          <Box sx={{ width: SIDEBAR_WIDTH }} />{" "}
          {/* Spacer to balance the layout */}
        </Toolbar>
      </AppBar>

      <Sidebar bboxCenter={bboxCenter} />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Toolbar /> {/* Spacing below AppBar */}
        {/* Map - Top Half */}
        <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
          <MapLibreMap
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
            options={{
              center: mapCenter,
              zoom: 14,
              style:
                "https://wms.wheregroup.com/tileserver/style/osm-bright.json",
            }}
          />
        </Box>
        <Divider />
        {/* Model Preview - Bottom Half */}
        <Box
          sx={{ flex: 1, position: "relative", minHeight: 0, zIndex: 10000 }}
        >
          <Suspense fallback={<CircularProgress />}>
                <ModelPreview />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
};

export default App;
