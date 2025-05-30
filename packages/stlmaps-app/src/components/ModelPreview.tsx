import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { CircularProgress } from "@mui/material";
import * as THREE from "three";
// @ts-expect-error
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
// @ts-expect-error
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
// @ts-expect-error
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
// @ts-expect-error
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
// @ts-expect-error
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
// @ts-expect-error
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
// @ts-expect-error
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Sprite, SpriteMaterial, CanvasTexture } from "three";
import useLayerStore from "../stores/useLayerStore";

interface ModelPreviewProps {}

// Interface for scene data to be stored in ref
interface SceneData {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  modelGroup: THREE.Group;
  composer: EffectComposer;
  animationFrameId?: number;
  initialized: boolean;
  buttons: HTMLButtonElement[];
  savedCameraPosition?: THREE.Vector3;
  savedCameraTarget?: THREE.Vector3;
  cameraUpdateTimeoutId?: NodeJS.Timeout | null;
  isFirstRender?: boolean;
}

/**
 * Detects device capabilities and recommends the appropriate rendering mode
 */
const detectDeviceCapabilities = (): 'quality' | 'performance' => {
  console.log("Detecting device capabilities for optimal rendering mode");
  
  // Check for mobile devices first - they generally need performance mode
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Get device memory (available in Chrome)
  // @ts-expect-error - navigator.deviceMemory is not in TypeScript defs
  const deviceMemory = navigator.deviceMemory || 4; // Default to 4GB if not available
  
  // Check for hardware concurrency (CPU cores)
  const cpuCores = navigator.hardwareConcurrency || 4; // Default to 4 cores
  
  // Check screen resolution
  const pixelCount = window.screen.width * window.screen.height;
  const isHighResolution = pixelCount > (1920 * 1080);
  
  // Try to detect GPU performance using canvas
  let gpuPowerScore = 0;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (gl) {
      // @ts-expect-error - This property exists on WebGL contexts
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        // @ts-expect-error - This constant exists when the extension is available
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        
        // Check for keywords indicating powerful GPUs
        const knownHighPerformanceGPUs = [
          'NVIDIA', 'RTX', 'GTX', 'Quadro',
          'AMD', 'Radeon', 'FirePro',
          'Intel Iris', 'Apple M1', 'Apple M2', 'Apple M3'
        ];
        
        for (const gpu of knownHighPerformanceGPUs) {
          if (renderer && renderer.indexOf(gpu) !== -1) {
            gpuPowerScore += 1;
          }
        }
        
        // Mobile GPUs typically have 'Mali', 'Adreno', 'PowerVR' in their name
        const mobileGPUs = ['Mali', 'Adreno', 'PowerVR', 'Apple GPU'];
        for (const gpu of mobileGPUs) {
          if (renderer && renderer.indexOf(gpu) !== -1) {
            gpuPowerScore -= 1; // Reduce score for mobile GPUs
          }
        }
        
        console.log("Detected GPU:", renderer);
      }
      
      // Check supported extensions as another indicator
      const extensions = gl.getSupportedExtensions() || [];
      const advancedExtensions = [
        'EXT_color_buffer_float',
        'OES_texture_float',
        'WEBGL_color_buffer_float',
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_depth_texture'
      ];
      
      for (const ext of advancedExtensions) {
        if (extensions.includes(ext)) {
          gpuPowerScore += 0.5;
        }
      }
      
      // Test draw call performance with a basic benchmark
      const startTime = performance.now();
      let testIterations = 0;
      const testDrawCalls = () => {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.flush();
        testIterations++;
        
        if (performance.now() - startTime < 50) { // 50ms test
          testDrawCalls();
        }
      };
      testDrawCalls();
      
      // Higher iterations = better performance
      if (testIterations > 1000) {
        gpuPowerScore += 2;
      } else if (testIterations > 500) {
        gpuPowerScore += 1;
      }
    }
  } catch (e) {
    console.warn("Error during GPU capability detection:", e);
  }

  // Combine factors to make decision
  let useQualityMode = true;
  
  // Score-based decision
  let totalScore = 0;
  
  // Device factors
  totalScore -= isMobileDevice ? 3 : 2;
  totalScore += Math.min(deviceMemory / 2, 4); // Up to 4 points for 8GB+ RAM
  totalScore += Math.min(cpuCores / 2, 4);     // Up to 4 points for 8+ cores
  totalScore -= isHighResolution ? 1 : 0;      // High resolution is demanding
  totalScore += gpuPowerScore;                 // Add GPU power score
  
  // Check for battery status if available
  // @ts-expect-error - navigator.getBattery is not in all TypeScript defs
  if (navigator.getBattery) {
    // @ts-expect-error - navigator.getBattery is not in all TypeScript defs
    navigator.getBattery().then(battery => {
      if (battery.charging === false && battery.level < 0.5) {
        // If on battery and below 50%, prefer performance mode
        totalScore -= 2;
      }
    }).catch(() => {
      // Ignore errors from battery API
    });
  }
  
  console.log("Device capability score:", totalScore);
  
  // Set threshold for quality mode
  useQualityMode = totalScore >= 2;
  
  const recommendedMode = useQualityMode ? 'quality' : 'performance';
  console.log("Recommended rendering mode:", recommendedMode);
  
  return recommendedMode;
};

const ModelPreview = ({}: ModelPreviewProps) => {
  // Get geometry data and settings from the Zustand store
  const { geometryDataSets, terrainSettings, renderingSettings, setRenderingMode } = useLayerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneDataRef = useRef<SceneData | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSetInitialMode, setHasSetInitialMode] = useState<boolean>(false);
  
  // Access the current rendering mode
  const renderingMode = renderingSettings.mode;
  
  // Store camera position and target to persist across re-renders
  const [cameraPosition, setCameraPosition] = useState<THREE.Vector3 | null>(null);
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);

  // Resize handler function to update renderer when container size changes
  const handleResize = useCallback(() => {
    if (!containerRef.current || !rendererRef.current || !sceneDataRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    if (width === 0 || height === 0) return;
    
    // Update camera aspect ratio
    const { camera, composer } = sceneDataRef.current;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    // Update renderer size
    rendererRef.current.setSize(width, height);
    
    // Update composer size
    composer.setSize(width, height);
  }, []);

  // Initialize Three.js scene
  const initScene = useCallback(() => {
    // Only initialize if we don't have a renderer yet or if rendering mode has changed
    const shouldInitialize = !rendererRef.current || 
      (sceneDataRef.current && sceneDataRef.current.renderingMode !== renderingMode);
    
    if (!containerRef.current || !shouldInitialize) return;
    
    // Clean up existing renderer and scene if they exist
    if (rendererRef.current) {
      console.log("Cleaning up existing Three.js scene before re-initialization");
      if (containerRef.current.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
      rendererRef.current = null;
      
      if (sceneDataRef.current?.animationFrameId) {
        cancelAnimationFrame(sceneDataRef.current.animationFrameId);
      }
    }
    
    try {
      console.log("Initializing Three.js scene");
      setLoading(true);
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      if (width === 0 || height === 0) {
        throw new Error("Container has zero width or height");
      }
      
      // Setup renderer with settings based on rendering mode
      rendererRef.current = new THREE.WebGLRenderer({
        antialias: renderingMode === 'quality',
        alpha: true,
        powerPreference: "high-performance",
        precision: renderingMode === 'quality' ? "highp" : "mediump",
      });
      rendererRef.current.setSize(width, height);
      rendererRef.current.setPixelRatio(
        renderingMode === 'quality' 
          ? Math.min(window.devicePixelRatio, 2) 
          : Math.min(window.devicePixelRatio, 1)
      );
      rendererRef.current.shadowMap.enabled = renderingMode === 'quality';
      rendererRef.current.shadowMap.type = renderingMode === 'quality' 
        ? THREE.PCFSoftShadowMap 
        : THREE.BasicShadowMap;
      rendererRef.current.outputEncoding = THREE.sRGBEncoding;
      rendererRef.current.toneMapping = renderingMode === 'quality'
        ? THREE.ACESFilmicToneMapping
        : THREE.LinearToneMapping;
      rendererRef.current.toneMappingExposure = renderingMode === 'quality' ? 0.8 : 1.0;
      rendererRef.current.physicallyCorrectLights = renderingMode === 'quality';
      containerRef.current.appendChild(rendererRef.current.domElement);
      
      // Create scene
      const scene = new THREE.Scene();
      
      // Setup camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
      
      // Add orbit controls
      const controls = new OrbitControls(camera, rendererRef.current.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.screenSpacePanning = true;
      controls.minDistance = 0.1;
      controls.maxDistance = 500;
      controls.maxPolarAngle = Math.PI * 0.85;
      
      // Create post-processing composer
      const composer = new EffectComposer(rendererRef.current);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      
      // Configure post-processing based on rendering mode
      if (renderingMode === 'quality') {
        // Add bloom effect (quality mode only)
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, height),
          0.3,
          0.35,
          0.9
        );
        composer.addPass(bloomPass);
        
        // Add ambient occlusion (quality mode only)
        const ssaoPass = new SSAOPass(scene, camera, width, height);
        ssaoPass.kernelRadius = 16;
        ssaoPass.minDistance = 0.005;
        ssaoPass.maxDistance = 0.1;
        composer.addPass(ssaoPass);
      }
      
      // Final output pass
      const outputPass = new OutputPass();
      composer.addPass(outputPass);
      
      // Setup environment map
      const pmremGenerator = new THREE.PMREMGenerator(rendererRef.current);
      pmremGenerator.compileEquirectangularShader();
      
      // Create a default environment map
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const context = canvas.getContext('2d');
      if (context) {
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#a1c4fd');
        gradient.addColorStop(0.4, '#f9d976');
        gradient.addColorStop(0.7, '#c2e9fb');
        gradient.addColorStop(1, '#81d8d0');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      const envTexture = new THREE.CanvasTexture(canvas);
      envTexture.mapping = THREE.EquirectangularReflectionMapping;
      
      const envMap = pmremGenerator.fromEquirectangular(envTexture).texture;
      scene.environment = envMap;
      scene.background = envMap;
      
      pmremGenerator.dispose();
      
      // Add strategic lighting with settings based on rendering mode
      const keyLight = new THREE.DirectionalLight(0xfffbf0, 0.9);
      keyLight.position.set(1, 2, 3);
      
      if (renderingMode === 'quality') {
        // High-quality shadow settings
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 100;
        keyLight.shadow.camera.left = -50;
        keyLight.shadow.camera.right = 50;
        keyLight.shadow.camera.top = 50;
        keyLight.shadow.camera.bottom = -50;
        keyLight.shadow.radius = 12;
        keyLight.shadow.blurSamples = 8;
        keyLight.shadow.bias = -0.0001;
      } else {
        // No shadows in performance mode
        keyLight.castShadow = false;
      }
      scene.add(keyLight);
      
      // Only add extra lights in quality mode
      if (renderingMode === 'quality') {
        const rimLight = new THREE.DirectionalLight(0xc4e0ff, 0.3);
        rimLight.position.set(-3, 1, -2);
        scene.add(rimLight);
        
        const sunsetLight = new THREE.DirectionalLight(0xff7e47, 1.8);
        sunsetLight.position.set(-5, 30, 30);
        sunsetLight.castShadow = true;
        sunsetLight.shadow.mapSize.width = 2048;
        sunsetLight.shadow.mapSize.height = 2048;
        sunsetLight.shadow.camera.near = 0.1;
        sunsetLight.shadow.camera.far = 500;
        sunsetLight.shadow.camera.left = -120;
        sunsetLight.shadow.camera.right = 120;
        sunsetLight.shadow.camera.top = 120;
        sunsetLight.shadow.camera.bottom = -120;
        sunsetLight.shadow.bias = -0.0003;
        sunsetLight.shadow.radius = 4;
        scene.add(sunsetLight);
        
        const fillLight = new THREE.DirectionalLight(0xfff0c0, 0.2);
        fillLight.position.set(2, -1, -1);
        scene.add(fillLight);
      } else {
        // Add a basic directional light for performance mode
        const simpleLight = new THREE.DirectionalLight(0xffffff, 1.0);
        simpleLight.position.set(-5, 10, 7);
        scene.add(simpleLight);
      }
      
      // Always add ambient light but with different intensity
      const ambientLight = new THREE.HemisphereLight(
        0xffffff, 
        0xf0f5ff, 
        renderingMode === 'quality' ? 2.7 : 3.5
      );
      scene.add(ambientLight);
      
      // Create a model group for all geometry
      const modelGroup = new THREE.Group();
      scene.add(modelGroup);
      
      // Set camera position
      if (cameraPosition && cameraTarget) {
        camera.position.copy(cameraPosition);
        controls.target.copy(cameraTarget);
      } else {
        camera.position.set(0, -200, 100);
        controls.target.set(0, 0, 0);
      }
      camera.updateProjectionMatrix();
      
      // Add camera helper buttons
      const buttons: HTMLButtonElement[] = [];
      const addCameraPositionButton = (label: string, position: [number, number, number]) => {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.position = 'absolute';
        button.style.bottom = '10px';
        button.style.padding = '8px 12px';
        button.style.margin = '0 5px';
        button.style.backgroundColor = '#2196F3';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.zIndex = '100';
        button.style.fontSize = '12px';
        button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        
        button.addEventListener('click', () => {
          const [x, y, z] = position;
          camera.position.set(x, y, z);
          controls.target.set(0, 0, 0);
          camera.updateProjectionMatrix();
        });
        
        if (containerRef.current) {
          containerRef.current.appendChild(button);
          buttons.push(button);
        }
        
        return button;
      };
      
      const topButton = addCameraPositionButton('Top', [0, 50, 200]);
      topButton.style.left = '10px';
      
      const frontButton = addCameraPositionButton('Initial', [0, -200, 100]);
      frontButton.style.left = '60px';
      
      // Store all the scene data in the ref
      sceneDataRef.current = {
        scene,
        camera,
        controls,
        modelGroup,
        composer,
        initialized: true,
        buttons,
        isFirstRender: true,
        renderingMode // Store the current rendering mode to detect changes
      };
      
      // Animation loop
      const animate = () => {
        if (!rendererRef.current || !sceneDataRef.current) return;
        
        const { controls, camera, composer } = sceneDataRef.current;
        
        // Save camera position and target when it changes, with debouncing
        if (controls.target && camera.position) {
          // Store the camera position and target in a ref to avoid state updates during animation
          if (!sceneDataRef.current.savedCameraPosition ||
              !camera.position.equals(sceneDataRef.current.savedCameraPosition) || 
              !controls.target.equals(sceneDataRef.current.savedCameraTarget || new THREE.Vector3())) {
            
            // Store the current position and target in the ref
            sceneDataRef.current.savedCameraPosition = camera.position.clone();
            sceneDataRef.current.savedCameraTarget = controls.target.clone();
            
            // Only update the state occasionally to avoid re-renders
            if (!sceneDataRef.current.cameraUpdateTimeoutId) {
              sceneDataRef.current.cameraUpdateTimeoutId = setTimeout(() => {
                setCameraPosition(camera.position.clone());
                setCameraTarget(controls.target.clone());
                sceneDataRef.current.cameraUpdateTimeoutId = null;
              }, 500); // Update state after 500ms of no camera movement
            }
          }
        }
        
        sceneDataRef.current.animationFrameId = requestAnimationFrame(animate);
        controls.update();
        
        // Use the composer for enhanced rendering with post-processing
        composer.render();
      };
      
      // @ts-expect-error
      document.debug_camera = camera; // Expose camera to global scope for debugging
      
      animate();
      console.log("Scene initialization completed");
      updateScene();
      
    } catch (setupError) {
      console.error("Error setting up 3D scene:", setupError);
      setError(
        `Failed to setup 3D viewer: ${
          setupError instanceof Error
            ? setupError.message
            : String(setupError)
        }`
      );
      setLoading(false);
    }
  }, [renderingMode]); // Only depend on rendering mode, not camera position
  
  // Update scene geometry with latest data
  const updateScene = useCallback(() => {
    if (!sceneDataRef.current || !rendererRef.current) return;
    
    try {
      console.log("Updating model geometry", {
        hasTerrainGeometry: !!geometryDataSets.terrainGeometry,
        hasPolygonGeometries: !!geometryDataSets.polygonGeometries?.length,
        renderingMode
      });
      const { scene, modelGroup } = sceneDataRef.current;
      
      // Clear existing geometry
      while (modelGroup.children.length > 0) {
        const child = modelGroup.children[0];
        modelGroup.remove(child);
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      }
      
      // Add terrain if available
      if (geometryDataSets.terrainGeometry) {
        console.log("Adding terrain geometry to scene:", {
          vertexCount: geometryDataSets.terrainGeometry.attributes?.position?.count || 0,
          valid: !!geometryDataSets.terrainGeometry.attributes?.position?.count
        });
        // Create terrain material based on rendering mode
        let terrainMaterial;
        
        if (renderingMode === 'quality') {
          // High-quality material with more complex properties
          terrainMaterial = new THREE.MeshStandardMaterial({
            vertexColors: terrainSettings.color ? false : true,
            color: terrainSettings.color ? new THREE.Color(terrainSettings.color) : undefined,
            roughness: 0.8,
            metalness: 0.01,
            envMapIntensity: 0.4,
            flatShading: true,
            side: THREE.DoubleSide
          });
        } else {
          // Performance-optimized material with simpler properties
          terrainMaterial = new THREE.MeshLambertMaterial({
            vertexColors: terrainSettings.color ? false : true,
            color: terrainSettings.color ? new THREE.Color(terrainSettings.color) : undefined,
            flatShading: true,
            side: THREE.DoubleSide
          });
        }
        
        // Apply the material to the terrain mesh
        const geometryMesh = new THREE.Mesh(
          geometryDataSets.terrainGeometry,
          terrainMaterial
        );
        geometryMesh.castShadow = renderingMode === 'quality';
        geometryMesh.receiveShadow = renderingMode === 'quality';
        modelGroup.add(geometryMesh);
      }
      
      // Process polygon geometries
      if (geometryDataSets.polygonGeometries && geometryDataSets.polygonGeometries.length > 0) {
        geometryDataSets.polygonGeometries.forEach(({geometry, ...vtDataset}) => {
          // Create color for polygon
          const baseColor = vtDataset.color || new THREE.Color(0x81ecec);
          
          // Create slightly brightened color
          const enhancedColor = new THREE.Color().copy(baseColor).convertSRGBToLinear();
          enhancedColor.r = Math.min(1, enhancedColor.r * 1.2);
          enhancedColor.g = Math.min(1, enhancedColor.g * 1.2);
          enhancedColor.b = Math.min(1, enhancedColor.b * 1.2);
          
          // Create material based on rendering mode
          let polygonMaterial;
          
          if (renderingMode === 'quality') {
            // High-quality material with physically-based properties
            polygonMaterial = new THREE.MeshPhysicalMaterial({
              color: enhancedColor,
              roughness: 0.35,
              metalness: 0.01,
              clearcoat: 0.06,
              clearcoatRoughness: 2,
              envMapIntensity: 0.7,
              flatShading: false,
              side: THREE.DoubleSide
            });
          } else {
            // Performance-optimized simpler material
            polygonMaterial = new THREE.MeshStandardMaterial({
              color: enhancedColor,
              roughness: 0.5,
              metalness: 0,
              flatShading: true,
              side: THREE.DoubleSide
            });
          }
          
          // Create mesh
          const polygonMesh = new THREE.Mesh(geometry, polygonMaterial);
          polygonMesh.castShadow = renderingMode === 'quality';
          polygonMesh.receiveShadow = renderingMode === 'quality';
          modelGroup.add(polygonMesh);
        });
      }
      
      setLoading(false);
    } catch (updateError) {
      console.error("Error updating scene:", updateError);
      setError(
        `Failed to update 3D scene: ${
          updateError instanceof Error
            ? updateError.message
            : String(updateError)
        }`
      );
      setLoading(false);
    }
  }, [geometryDataSets.terrainGeometry, geometryDataSets.polygonGeometries, terrainSettings, renderingMode]);
  
  // Initialize scene when component mounts
  useEffect(() => {
    if (!containerRef.current) return;
    
    console.log("ModelPreview mounted");

    // Auto-detect and set optimal rendering mode on first mount
    if (!hasSetInitialMode) {
      const detectedMode = detectDeviceCapabilities();
      console.log(`Setting initial rendering mode to ${detectedMode} based on device capabilities`);
      setRenderingMode(detectedMode);
      setHasSetInitialMode(true);
    }
    
    // Clear any existing canvases in the container first
    containerRef.current.querySelectorAll('button').forEach(button => {
      console.log("Removing existing buttons before initialization");
      button.remove();
    });
    // Clear any existing canvases in the container first
    containerRef.current.querySelectorAll('canvas').forEach(canvas => {
      console.log("Removing existing canvas before initialization");
      canvas.remove();
    });
    
    initScene();
    
    // Setup resize handler
    const handleResizeWrapper = () => handleResize();
    window.addEventListener('resize', handleResizeWrapper);
    
    // Setup ResizeObserver
    const resizeObserver = new ResizeObserver(handleResizeWrapper);
    resizeObserverRef.current = resizeObserver;
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // Cleanup when component unmounts
    return () => {
      console.log("Cleaning up ModelPreview resources");
      window.removeEventListener('resize', handleResizeWrapper);
      
      if (resizeObserverRef.current && containerRef.current) {
        resizeObserverRef.current.unobserve(containerRef.current);
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      
      if (sceneDataRef.current?.animationFrameId) {
        cancelAnimationFrame(sceneDataRef.current.animationFrameId);
      }
      
      // Remove buttons
      if (sceneDataRef.current?.buttons) {
        sceneDataRef.current.buttons.forEach(button => {
          if (containerRef.current?.contains(button)) {
            containerRef.current.removeChild(button);
          }
        });
      }
      
      // Dispose of ThreeJS resources
      if (sceneDataRef.current) {
        const { scene, modelGroup } = sceneDataRef.current;
        
        // Dispose of all geometries and materials in the model group
        while (modelGroup.children.length > 0) {
          const child = modelGroup.children[0];
          modelGroup.remove(child);
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        }
        
        scene.clear();
        sceneDataRef.current = null;
      }
      
      if (rendererRef.current) {
        if (containerRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [initScene, handleResize]);
  
  // Update scene when geometry data or rendering mode changes
  useEffect(() => {
    if (sceneDataRef.current?.initialized) {
      console.log("Triggering updateScene due to dependency changes");
      updateScene();
    }
  }, [updateScene, geometryDataSets.terrainGeometry, geometryDataSets.polygonGeometries, renderingMode]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
      data-testid="model-container"
    >
      {loading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255,255,255,0.7)",
            zIndex: 1,
          }}
        >
          <CircularProgress size={48} />
          <p style={{ marginTop: 16 }}>Loading 3D model...</p>
        </div>
      )}
      {error && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "red",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default ModelPreview;
