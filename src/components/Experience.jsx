import {
  Environment,
  OrthographicCamera,
  OrbitControls,
} from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { useControls } from "leva";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { GodotCharacterHybrid } from "./GodotCharacterHybrid";
import * as THREE from "three";
import { useLightsControls } from "./useLightsControls";
import { Csm } from "./Csm";
import { SSAOEffect } from "./SSAOEffect";
import { getDefaultMapKey, useActiveMap } from "./useActiveMap";
import { mapOrder } from "./mapDefinitions";

export const Experience = () => {
  const [characterSpawnPosition, setCharacterSpawnPosition] = useState([
    0, 10, 0,
  ]);
  const [isTerrainReady, setIsTerrainReady] = useState(false);
  const [teleportRequest, setTeleportRequest] = useState(null);

  const directionalLightRef = useRef();
  const characterPositionVector = useRef(new THREE.Vector3());
  const characterVelocity = useRef(new THREE.Vector3());
  const characterRotation = useRef(0);
  const defaultMap = getDefaultMapKey();
  // Create map options with display names for map15, map16, and map6
  const mapOptions = useMemo(() => {
    const options = {};
    mapOrder.forEach((mapKey) => {
      if (mapKey === "map15") {
        options["map15 (parkour)"] = mapKey;
      } else if (mapKey === "map16") {
        options["map16 (city)"] = mapKey;
      } else if (mapKey === "map6") {
        options["map6 (Zeldaterrain1-GLB)"] = mapKey;
      } else {
        options[mapKey] = mapKey;
      }
    });
    return options;
  }, []);
  
  const { map, cameraMode } = useControls("Map", {
    map: {
      value: defaultMap,
      options: mapOptions,
    },
    cameraMode: {
      value: defaultMap === "map18" ? "2.5dcamera" : "follow",
      options: defaultMap === "map18"
        ? ["2.5dcamera", "orbit"]
        : ["follow", "orbit", "follow-orbit", "2.5dcamera"],
      label: "Camera Mode",
    },
  });
  
  // Detect if map18 is active for 2.5D mode (for character movement constraints)
  const isMap18 = map === "map18";
  
  // Use selected camera mode
  const effectiveCameraMode = cameraMode;

  const { showRapierDebug } = useControls("🐛 DEBUG", {
    showRapierDebug: {
      value: false,
      label: "🔍 Show Rapier Physics Debug",
    },
  });

  // Get lights controls from separate hook
  const {
    envType,
    envPreset,
    envCustomUrl,
    envIntensity,
    envBackground,
    envBackgroundBlurriness,
    envBackgroundIntensity,
    ambientIntensity,
    directionalIntensity,
    directionalPosition: defaultDirectionalPosition,
    directionalColor,
    shadowMapSize,
    shadowBias,
    shadowNormalBias,
    shadowRadius,
    shadowCameraLeft,
    shadowCameraRight,
    shadowCameraTop,
    shadowCameraBottom,
    shadowCameraNear,
    shadowCameraFar,
    followCharacter,
    shadowFollowRadius,
    useCascadedShadows,
    csmCascades,
    csmFade,
    csmLightMargin,
    csmPracticalLambda,
    csmMaxFar,
    showTestSphere,
  } = useLightsControls();

  const handleTerrainReady = useCallback(() => {
    setTimeout(() => {
      setIsTerrainReady(true);
    }, 200);
  }, []);

  const handleTeleportRequest = useCallback((request) => {
    setTeleportRequest(request);
  }, []);

  const handleTeleportHandled = useCallback((id) => {
    setTeleportRequest((current) => {
      if (current && current.id === id) {
        return null;
      }
      return current;
    });
  }, []);

  const activeMap = useActiveMap(map, {
    characterPosition: characterPositionVector.current,
    characterVelocity: characterVelocity.current,
    onTerrainReady: handleTerrainReady,
    onTeleportRequest: handleTeleportRequest,
  });

  const directionalPosition = useMemo(
    () => activeMap.directionalOverride ?? defaultDirectionalPosition,
    [activeMap.directionalOverride, defaultDirectionalPosition]
  );

  const lightDirectionArray = useMemo(() => {
    const direction = new THREE.Vector3(
      -directionalPosition[0],
      -directionalPosition[1],
      -directionalPosition[2]
    );
    if (direction.lengthSq() === 0) {
      return [0, -1, 0];
    }
    direction.normalize();
    return [direction.x, direction.y, direction.z];
  }, [directionalPosition]);

  const csmMaterialVersion = useMemo(
    () => `${map}-${isTerrainReady}`,
    [map, isTerrainReady]
  );

  const MapComponent = activeMap.mapComponent;
  const mapProps = activeMap.mapProps;

  // Track previous map to detect actual changes (initialize to null for first run)
  const prevMapRef = useRef(null);

  // Calculate smart spawn positions when map changes
  useEffect(() => {
    const previousMap = prevMapRef.current;
    if (previousMap !== map) {
      prevMapRef.current = map;
      setTeleportRequest(null);
    } else {
      return;
    }

    // Always wait for terrain ready - ALL maps must call onTerrainReady before character spawns
    setIsTerrainReady(false);

    setCharacterSpawnPosition(activeMap.spawnPosition);
  }, [map, activeMap]);

  // Update shadow camera position to follow character when enabled
  useFrame(() => {
    if (useCascadedShadows) {
      return;
    }

    if (followCharacter && directionalLightRef.current && isTerrainReady) {
      const light = directionalLightRef.current;

      // Access shadow camera from light's shadow object
      if (!light.shadow || !light.shadow.camera) return;

      const shadowCamera = light.shadow.camera;
      const charPos = characterPositionVector.current;

      // Calculate light direction (normalized direction from light position)
      const lightDir = new THREE.Vector3(...directionalPosition).normalize();

      const cameraHeight = 50; // Height above character
      const lightReversed = lightDir.clone().multiplyScalar(-1); // Reverse direction

      shadowCamera.position.set(
        charPos.x + lightReversed.x * cameraHeight,
        charPos.y + lightReversed.y * cameraHeight + cameraHeight,
        charPos.z + lightReversed.z * cameraHeight
      );

      // Point camera at character
      shadowCamera.lookAt(charPos.x, charPos.y, charPos.z);

      // Update light target (important for directional light shadows)
      if (light.target) {
        light.target.position.set(charPos.x, charPos.y, charPos.z);
        light.target.updateMatrixWorld();
      }

      // Dynamic frustum bounds - increase radius for better coverage
      // Keep shadows sharp at character but extend to cover nearby objects
      const tightBounds = shadowFollowRadius;
      shadowCamera.left = -tightBounds;
      shadowCamera.right = tightBounds;
      shadowCamera.top = tightBounds;
      shadowCamera.bottom = -tightBounds;

      // Update matrices and force shadow update
      shadowCamera.updateProjectionMatrix();
      shadowCamera.updateMatrixWorld();
      light.shadow.needsUpdate = true;
      light.shadow.updateMatrices(light);
    } else if (!followCharacter && directionalLightRef.current) {
      // Restore original bounds when not following
      const light = directionalLightRef.current;
      if (light.shadow && light.shadow.camera) {
        const shadowCamera = light.shadow.camera;
        shadowCamera.left = shadowCameraLeft;
        shadowCamera.right = shadowCameraRight;
        shadowCamera.top = shadowCameraTop;
        shadowCamera.bottom = shadowCameraBottom;
        shadowCamera.updateProjectionMatrix();
        light.shadow.needsUpdate = true;
        light.shadow.updateMatrices(light);
      }
    }
  });

  return (
    <>
      {effectiveCameraMode === "orbit" && (
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={2000}
        />
      )}
      {envType === "preset" ? (
        <Environment
          preset={envPreset}
          environmentIntensity={envIntensity}
          background={envBackground}
          backgroundBlurriness={envBackgroundBlurriness}
          backgroundIntensity={envBackgroundIntensity}
        />
      ) : (
        <Environment
          files={envCustomUrl}
          environmentIntensity={envIntensity}
          background={envBackground}
          backgroundBlurriness={envBackgroundBlurriness}
          backgroundIntensity={envBackgroundIntensity}
        />
      )}
      <ambientLight intensity={ambientIntensity} />
      {useCascadedShadows ? (
        <Csm
          enabled={useCascadedShadows}
          cascades={csmCascades}
          shadowMapSize={shadowMapSize}
          shadowBias={shadowBias}
          shadowNormalBias={shadowNormalBias}
          lightDirection={lightDirectionArray}
          lightIntensity={directionalIntensity}
          lightColor={directionalColor}
          fade={csmFade}
          lightMargin={csmLightMargin}
          practicalLambda={csmPracticalLambda}
          maxFar={csmMaxFar}
          materialVersion={csmMaterialVersion}
        />
      ) : (
        <directionalLight
          ref={directionalLightRef}
          intensity={directionalIntensity}
          color={directionalColor}
          castShadow
          position={directionalPosition}
          shadow-mapSize-width={shadowMapSize}
          shadow-mapSize-height={shadowMapSize}
          shadow-bias={shadowBias}
          shadow-normalBias={shadowNormalBias}
          shadow-radius={shadowRadius}
        >
          <OrthographicCamera
            left={shadowCameraLeft}
            right={shadowCameraRight}
            top={shadowCameraTop}
            bottom={shadowCameraBottom}
            near={shadowCameraNear}
            far={shadowCameraFar}
            attach={"shadow-camera"}
          />
        </directionalLight>
      )}
      <Physics key={map} debug={showRapierDebug}>
        <MapComponent {...mapProps} />
        {/* Only spawn character when terrain is ready */}
        {isTerrainReady && (
          <GodotCharacterHybrid
            cameraMode={effectiveCameraMode}
            is2_5DMode={isMap18}
            position={characterSpawnPosition}
            teleportRequest={teleportRequest}
            onTeleportHandled={handleTeleportHandled}
            onPositionChange={(pos) => {
              characterPositionVector.current.set(pos[0], pos[1], pos[2]);
            }}
            onVelocityChange={(vel) => {
              characterVelocity.current.set(vel[0], vel[1], vel[2]);
            }}
            onRotationChange={(rot) => {
              characterRotation.current = rot;
            }}
          />
        )}
      </Physics>
      {showTestSphere && (
        <mesh position={[0, 2, 5]} castShadow>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial
            metalness={0.8}
            roughness={0.2}
            envMapIntensity={envIntensity}
          />
        </mesh>
      )}
      {/* Post-processing effects */}
      <SSAOEffect />
    </>
  );
};
