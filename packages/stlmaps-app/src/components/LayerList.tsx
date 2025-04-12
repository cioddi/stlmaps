import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Switch,
  Slider,
  Paper,
  Divider,
  Collapse,
  IconButton,
  TextField,
  InputAdornment,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TerrainIcon from '@mui/icons-material/Terrain';
import BusinessIcon from '@mui/icons-material/Business';
import WaterIcon from '@mui/icons-material/Water';
import ParkIcon from '@mui/icons-material/Park';
import ForestIcon from '@mui/icons-material/Forest';
import DirectionsIcon from '@mui/icons-material/Directions';
import LayersIcon from '@mui/icons-material/Layers';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import * as THREE from 'three';
import { VtDataSet } from './GenerateMeshButton';
import useLayerStore from '../stores/useLayerStore';

// No props needed anymore as we'll use the Zustand store
interface LayerListProps {}

const StyledPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  margin: theme.spacing(0, 0, 2, 0),
  overflow: 'hidden',
}));

const LayerHeader = styled(ListItem)<{ active?: boolean }>(({ theme, active }) => ({
  backgroundColor: active 
    ? `${theme.palette.primary.main}10` 
    : theme.palette.background.paper,
  borderLeft: `3px solid ${active ? theme.palette.primary.main : 'transparent'}`,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: `${theme.palette.primary.main}20`,
  },
}));

const ColorCircle = styled(Box)<{ bgcolor: string }>(({ bgcolor }) => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  backgroundColor: bgcolor,
  border: '2px solid white',
  boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
  display: 'inline-block',
  marginRight: 8,
}));

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : null;
}

function rgbToHex(color: THREE.Color) {
  return '#' + 
    Math.floor(color.r * 255).toString(16).padStart(2, '0') +
    Math.floor(color.g * 255).toString(16).padStart(2, '0') +
    Math.floor(color.b * 255).toString(16).padStart(2, '0');
}

const LayerList: React.FC<LayerListProps> = () => {
  // Get state and actions from the Zustand store
  const {
    vtLayers,
    terrainSettings,
    buildingSettings,
    toggleLayerEnabled,
    setLayerColor,
    setLayerExtrusionDepth,
    setLayerZOffset,
    setLayerBufferSize,
    setTerrainSettings,
    setBuildingSettings,
  } = useLayerStore();

  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({
    terrain: true,
    buildings: true,
  });

  const handleLayerToggle = (index: number) => {
    toggleLayerEnabled(index);
  };
  
  const handleLayerColorChange = (index: number, hexColor: string) => {
    setLayerColor(index, hexColor);
  };
  
  const handleExtrusionChange = (index: number, value: number) => {
    setLayerExtrusionDepth(index, value);
  };
  
  const handleZOffsetChange = (index: number, value: number) => {
    setLayerZOffset(index, value);
  };
  
  const handleBufferSizeChange = (index: number, value: number) => {
    setLayerBufferSize(index, value);
  };

  const toggleExpand = (layerId: string) => {
    setExpandedLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
  };

  const getLayerIcon = (sourceLayer: string) => {
    switch (sourceLayer) {
      case 'water': return <WaterIcon />;
      case 'landcover':
      case 'landuse': return <ForestIcon />;
      case 'park': return <ParkIcon />;
      case 'transportation': return <DirectionsIcon />;
      default: return <LayersIcon />;
    }
  };

  return (
    <Box sx={{ width: '100%', maxHeight: '100%', overflowY: 'auto', px: 1 }}>
      {/* Terrain Layer */}
      <StyledPaper sx={{marginTop: 2}}>
        <LayerHeader active={terrainSettings.enabled} onClick={() => toggleExpand('terrain')}>
          <ListItemIcon>
            <TerrainIcon color={terrainSettings.enabled ? "primary" : "disabled"} />
          </ListItemIcon>
          <ListItemText primary="Terrain" />
          <FormControlLabel
            control={
              <Switch 
                checked={terrainSettings.enabled}
                onChange={() => setTerrainSettings({
                  enabled: !terrainSettings.enabled
                })}
                onClick={(e) => e.stopPropagation()}
              />
            }
            label=""
          />
          {expandedLayers.terrain ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </LayerHeader>
        
        <Collapse in={expandedLayers.terrain} timeout="auto" unmountOnExit>
          <Box sx={{ p: 2 }}>
            <Typography gutterBottom>
              Vertical Exaggeration: {terrainSettings.verticalExaggeration.toFixed(2)}
            </Typography>
            <Slider
              value={terrainSettings.verticalExaggeration}
              onChange={(_, newValue) => setTerrainSettings({
                verticalExaggeration: newValue as number
              })}
              min={0.01}
              max={1.0}
              step={0.01}
              marks={[
                { value: 0.01, label: "Min" },
                { value: 0.5, label: "Med" },
                { value: 1.0, label: "Max" },
              ]}
            />
            
            <Typography gutterBottom sx={{ mt: 2 }}>
              Base Height: {terrainSettings.baseHeight}
            </Typography>
            <Slider
              value={terrainSettings.baseHeight}
              onChange={(_, newValue) => setTerrainSettings({
                baseHeight: newValue as number
              })}
              min={0}
              max={100}
              step={1}
              marks={[
                { value: 0, label: "0" },
                { value: 50, label: "50" },
                { value: 100, label: "100" },
              ]}
            />
          </Box>
        </Collapse>
      </StyledPaper>
      
      {/* Vector Tile Layers */}
      {vtLayers.map((layer, index) => {
        const layerId = `layer-${index}-${layer.sourceLayer}`;
        const isExpanded = expandedLayers[layerId] || false;
        
        return (
          <StyledPaper key={layerId}>
            <LayerHeader 
              active={layer.enabled} 
              onClick={() => toggleExpand(layerId)}
            >
              <ListItemIcon>
                {getLayerIcon(layer.sourceLayer)}
              </ListItemIcon>
              <ListItemText 
                primary={layer.sourceLayer.charAt(0).toUpperCase() + layer.sourceLayer.slice(1)} 
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={layer.enabled !== false} 
                    onChange={() => handleLayerToggle(index)}
                    onClick={(e) => e.stopPropagation()}
                  />
                }
                label=""
              />
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </LayerHeader>
            
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <FormatColorFillIcon sx={{ mr: 1, color: rgbToHex(layer.color) }} />
                  <TextField
                    label="Color"
                    type="color"
                    value={rgbToHex(layer.color)}
                    onChange={(e) => handleLayerColorChange(index, e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <ColorCircle bgcolor={rgbToHex(layer.color)} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ width: '100%' }}
                    size="small"
                  />
                </Box>
                
                {layer.extrusionDepth !== undefined && (
                  <>
                    <Typography gutterBottom>
                      Extrusion Depth: {layer.extrusionDepth.toFixed(1)}
                    </Typography>
                    <Slider
                      value={layer.extrusionDepth}
                      onChange={(_, newValue) => handleExtrusionChange(index, newValue as number)}
                      min={0}
                      max={10}
                      step={0.1}
                      marks={[
                        { value: 0, label: "0" },
                        { value: 5, label: "5" },
                        { value: 10, label: "10" },
                      ]}
                    />
                  </>
                )}
                
                {layer.zOffset !== undefined && (
                  <>
                    <Typography gutterBottom sx={{ mt: 2 }}>
                      Z-Offset: {layer.zOffset.toFixed(1)}
                    </Typography>
                    <Slider
                      value={layer.zOffset}
                      onChange={(_, newValue) => handleZOffsetChange(index, newValue as number)}
                      min={-10}
                      max={10}
                      step={0.1}
                      marks={[
                        { value: -10, label: "-10" },
                        { value: 0, label: "0" },
                        { value: 10, label: "10" },
                      ]}
                    />
                  </>
                )}
                
                {layer.bufferSize !== undefined && (
                  <>
                    <Typography gutterBottom sx={{ mt: 2 }}>
                      Buffer Size: {layer.bufferSize.toFixed(1)}
                    </Typography>
                    <Slider
                      value={layer.bufferSize}
                      onChange={(_, newValue) => handleBufferSizeChange(index, newValue as number)}
                      min={0}
                      max={10}
                      step={0.1}
                      marks={[
                        { value: 0, label: "0" },
                        { value: 5, label: "5" },
                        { value: 10, label: "10" },
                      ]}
                    />
                  </>
                )}
              </Box>
            </Collapse>
          </StyledPaper>
        );
      })}
    </Box>
  );
};

export default LayerList;
