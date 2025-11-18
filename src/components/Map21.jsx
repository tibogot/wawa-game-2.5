import { RigidBody } from "@react-three/rapier";
import { useRef, useMemo, useEffect, useState } from "react";
import { useControls, folder } from "leva";
import { Stars } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import ClaudeGrassQuick from "./ClaudeGrassQuick";
import ClaudeGrassQuick2 from "./ClaudeGrassQuick2";
import ClaudeGrassQuick5 from "./ClaudeGrassQuick5";
import useClaudeGrassQuickControls from "./useClaudeGrassQuickControls";
import useClaudeGrassQuick2Controls from "./useClaudeGrassQuick2Controls";
import useClaudeGrassQuick5Controls from "./useClaudeGrassQuick5Controls";
import { HeightFog } from "./HeightFog";
import { useHeightFogControls } from "./useHeightFogControls";
import { useLensFlareControls } from "./useLensFlareControls";
import { useInstancedTreesControls } from "./useInstancedTreesControls";
import LensFlare from "./LensFlare";
import { Skybox } from "./Skybox";
import HorizonSky from "./HorizonSky";
import { InstancedTrees } from "./InstancedTrees";
import { useBVHRegistration } from "../hooks/useBVHRegistration";
import * as THREE from "three";

// 2.5D: Character spawns at z=-80, so parkour objects should be positioned along X-axis (left/right movement)
// with Z-axis variations for depth layering (keep close to -80 for gameplay)
const CHARACTER_Z = -80;

export const Map21 = ({
  scale = 1,
  position = [0, 0, 0],
  characterPosition,
  characterVelocity,
  onTerrainReady,
  ...props
}) => {
  const group = useRef();
  const [physicsReady, setPhysicsReady] = useState(false);

  // Refs for static meshes to register with BVH
  const terrainMeshRef = useRef(null);
  const staticMeshRefs = useRef([]);

  // Simple ground height function for flat plane
  const getGroundHeight = useMemo(
    () => (x, z) => 0, // Flat plane at y=0
    []
  );

  // Get ClaudeGrassQuick controls
  const claudeGrassQuickControls = useClaudeGrassQuickControls();
  // Get ClaudeGrassQuick2 controls
  // Leva flattens folder structure - all properties are at top level
  const claudeGrassQuick2Controls = useClaudeGrassQuick2Controls();
  // Get ClaudeGrassQuick5 controls
  const claudeGrassQuick5Controls = useClaudeGrassQuick5Controls();

  // Get Height Fog controls
  const { heightFogEnabled, fogColor, fogHeight, fogNear, fogFar } =
    useHeightFogControls();

  // Get LensFlare controls
  const {
    lensFlareEnabled,
    lensFlare1Enabled,
    lensFlare1Position,
    lensFlare1H,
    lensFlare1S,
    lensFlare1L,
    lensFlare1Intensity,
    lensFlare2Enabled,
    lensFlare2Position,
    lensFlare2H,
    lensFlare2S,
    lensFlare2L,
    lensFlare2Intensity,
    lensFlare3Enabled,
    lensFlare3Position,
    lensFlare3H,
    lensFlare3S,
    lensFlare3L,
    lensFlare3Intensity,
    flareDistance,
  } = useLensFlareControls();

  // Get InstancedTrees controls
  const {
    instancedTreesEnabled,
    instancedTreeCount,
    instancedPositionX,
    instancedPositionY,
    instancedPositionZ,
    instancedRadius,
    instancedMinRadius,
    scaleRangeMin,
    scaleRangeMax,
    castShadow,
    receiveShadow,
    enableTransparentSorting,
    enableBVH,
    bvhMargin,
    enableViewThickening,
    viewThickenPower,
    viewThickenStrength,
  } = useInstancedTreesControls();

  // Get Map21 controls
  const {
    skyboxEnabled,
    horizonSkyEnabled,
    horizonSkyTopColor,
    horizonSkyBottomColor,
    horizonSkyOffset,
    horizonSkyExponent,
    horizonSkyRadius,
    starsEnabled,
    starsRadius,
    starsDepth,
    starsCount,
    starsFactor,
    starsSaturation,
    starsFade,
    starsSpeed,
    nightBackgroundColor,
  } = useControls("🗺️ MAP 21", {
    skybox: folder(
      {
        skyboxEnabled: {
          value: false,
          label: "🌌 Enable Skybox",
        },
      },
      { collapsed: true }
    ),
    horizonSky: folder(
      {
        horizonSkyEnabled: {
          value: false,
          label: "🌅 Enable Horizon Sky",
        },
        horizonSkyTopColor: {
          value: "#0077ff",
          label: "🎨 Top Color",
        },
        horizonSkyBottomColor: {
          value: "#ffffff",
          label: "🎨 Bottom Color",
        },
        horizonSkyOffset: {
          value: 33,
          min: 0,
          max: 100,
          step: 1,
          label: "⬆️ Offset",
        },
        horizonSkyExponent: {
          value: 0.6,
          min: 0.1,
          max: 5,
          step: 0.1,
          label: "📈 Exponent",
        },
        horizonSkyRadius: {
          value: 4000,
          min: 500,
          max: 8000,
          step: 100,
          label: "🪐 Radius",
        },
      },
      { collapsed: true }
    ),
    nightSky: folder(
      {
        starsEnabled: {
          value: true,
          label: "✨ Enable Stars",
        },
        starsRadius: {
          value: 300,
          min: 100,
          max: 1000,
          step: 50,
          label: "⭐ Stars Radius",
        },
        starsDepth: {
          value: 50,
          min: 20,
          max: 200,
          step: 10,
          label: "🌌 Stars Depth",
        },
        starsCount: {
          value: 5000,
          min: 1000,
          max: 10000,
          step: 500,
          label: "✨ Stars Count",
        },
        starsFactor: {
          value: 4,
          min: 1,
          max: 10,
          step: 0.5,
          label: "💫 Star Size Factor",
        },
        starsSaturation: {
          value: 0,
          min: 0,
          max: 1,
          step: 0.1,
          label: "🎨 Star Saturation (0 = white)",
        },
        starsFade: {
          value: true,
          label: "🌅 Fade at Horizon",
        },
        starsSpeed: {
          value: 0.5,
          min: 0,
          max: 5,
          step: 0.1,
          label: "⚡ Rotation Speed",
        },
        nightBackgroundColor: {
          value: "#000011",
          label: "🌑 Night Background Color",
        },
      },
      { collapsed: false }
    ),
  });

  // Set scene background for night sky
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(nightBackgroundColor);
  }, [scene, nightBackgroundColor]);

  // Create stable fallback vectors
  const fallbackPosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const fallbackVelocity = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Call onTerrainReady after physics are initialized (simple maps with static geometry)
  useEffect(() => {
    if (onTerrainReady) {
      // Delay to ensure RigidBody physics are fully initialized
      const timer = setTimeout(() => {
        onTerrainReady();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [onTerrainReady]);

  // Set physicsReady after a delay (for dynamic objects like TileCube)
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPhysicsReady(true);
    }, 150);
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      setPhysicsReady(false);
    };
  }, []);

  // Register static meshes with BVH manager for character collision detection
  // Collect all static mesh refs
  const staticMeshes = useMemo(() => {
    const meshes = [];
    if (terrainMeshRef.current) meshes.push(terrainMeshRef.current);
    // Add other static meshes from refs array
    staticMeshRefs.current.forEach((ref) => {
      if (ref) meshes.push(ref);
    });
    return meshes;
  }, [physicsReady]); // Re-run when physics are ready

  // Register meshes with BVH manager
  useBVHRegistration(staticMeshes, true);

  // Simple terrain height function for flat floor (returns 0)
  const getTerrainHeight = useMemo(
    () => (x, z) => {
      return 0; // Flat floor at y=0
    },
    []
  );

  return (
    <group ref={group} {...props}>
      <HeightFog
        enabled={heightFogEnabled}
        fogColor={fogColor}
        fogHeight={fogHeight}
        fogNear={fogNear}
        fogFar={fogFar}
      />
      {starsEnabled && (
        <Stars
          radius={starsRadius}
          depth={starsDepth}
          count={starsCount}
          factor={starsFactor}
          saturation={starsSaturation}
          fade={starsFade}
          speed={starsSpeed}
        />
      )}
      {skyboxEnabled && <Skybox />}
      {horizonSkyEnabled && (
        <HorizonSky
          topColor={horizonSkyTopColor}
          bottomColor={horizonSkyBottomColor}
          offset={horizonSkyOffset}
          exponent={horizonSkyExponent}
          radius={horizonSkyRadius}
        />
      )}

      <RigidBody type="fixed" colliders="trimesh">
        <mesh
          ref={terrainMeshRef}
          position={position}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={scale}
          receiveShadow
        >
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial
            color="#1a3a1a"
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* Instanced Trees for garden atmosphere */}
      {instancedTreesEnabled && (
        <InstancedTrees
          count={instancedTreeCount}
          position={[
            instancedPositionX,
            instancedPositionY,
            instancedPositionZ !== 0 ? instancedPositionZ : CHARACTER_Z,
          ]}
          radius={instancedRadius}
          minRadius={instancedMinRadius}
          scaleRange={[scaleRangeMin, scaleRangeMax]}
          enabled={instancedTreesEnabled}
          getTerrainHeight={getTerrainHeight}
          enableBVH={enableBVH}
          bvhMargin={bvhMargin}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          enableTransparentSorting={enableTransparentSorting}
          enableViewThickening={enableViewThickening}
          viewThickenPower={viewThickenPower}
          viewThickenStrength={viewThickenStrength}
        />
      )}

      {/* Physics Debug Cubes - positioned for 2.5D */}
      {/* <PhysicsDebugCubes
          enabled={physicsReady}
          spawnHeight={5}
          zOffset={CHARACTER_Z}
        /> */}

      {/* 2.5D Parkour Objects - Positioned along X-axis (left/right movement) with Z-axis at CHARACTER_Z for gameplay */}
      {/* Basic parkour tiles */}
      {/* <ParkourTile position={[10, 0, CHARACTER_Z]} /> */}

      {/* ClaudeGrassQuick - Quick_Grass port with advanced shaders */}
      {claudeGrassQuickControls.enabled && (
        <ClaudeGrassQuick
          playerPosition={
            new THREE.Vector3(
              characterPosition[0],
              characterPosition[1],
              characterPosition[2]
            )
          }
          terrainSize={claudeGrassQuickControls.terrainSize}
          heightScale={claudeGrassQuickControls.heightScale}
          heightOffset={claudeGrassQuickControls.heightOffset}
          grassWidth={claudeGrassQuickControls.grassWidth}
          grassHeight={claudeGrassQuickControls.grassHeight}
          lodDistance={claudeGrassQuickControls.lodDistance}
          maxDistance={claudeGrassQuickControls.maxDistance}
          patchSize={claudeGrassQuickControls.patchSize}
        />
      )}

      {/* ClaudeGrassQuick2 - Quick_Grass port with advanced shaders (Working Version) */}
      {claudeGrassQuick2Controls &&
        claudeGrassQuick2Controls.enabled === true && (
          <ClaudeGrassQuick2
            playerPosition={
              new THREE.Vector3(
                characterPosition[0],
                characterPosition[1],
                characterPosition[2]
              )
            }
            terrainSize={claudeGrassQuick2Controls.terrainSize}
            heightScale={claudeGrassQuick2Controls.heightScale}
            heightOffset={claudeGrassQuick2Controls.heightOffset}
            grassWidth={claudeGrassQuick2Controls.grassWidth}
            grassHeight={claudeGrassQuick2Controls.grassHeight}
            lodDistance={claudeGrassQuick2Controls.lodDistance}
            maxDistance={claudeGrassQuick2Controls.maxDistance}
            patchSize={claudeGrassQuick2Controls.patchSize}
            specularEnabled={claudeGrassQuick2Controls.specularEnabled}
            lightDirectionX={claudeGrassQuick2Controls.lightDirectionX}
            lightDirectionY={claudeGrassQuick2Controls.lightDirectionY}
            lightDirectionZ={claudeGrassQuick2Controls.lightDirectionZ}
            specularColor={claudeGrassQuick2Controls.specularColor}
            specularIntensity={claudeGrassQuick2Controls.specularIntensity}
            shininess={claudeGrassQuick2Controls.shininess}
          />
        )}

      {/* ClaudeGrassQuick5 - Quick_Grass port (New working version) */}
      {claudeGrassQuick5Controls.enabled && (
        <ClaudeGrassQuick5
          playerPosition={characterPosition || [0, 0, 0]}
          terrainSize={claudeGrassQuick5Controls.terrainSize}
          heightScale={claudeGrassQuick5Controls.heightScale}
          heightOffset={claudeGrassQuick5Controls.heightOffset}
          grassWidth={claudeGrassQuick5Controls.grassWidth}
          grassHeight={claudeGrassQuick5Controls.grassHeight}
          grassDensity={claudeGrassQuick5Controls.grassDensity}
          lodDistance={claudeGrassQuick5Controls.lodDistance}
          maxDistance={claudeGrassQuick5Controls.maxDistance}
          patchSize={claudeGrassQuick5Controls.patchSize}
          gridSize={claudeGrassQuick5Controls.gridSize}
          patchSpacing={claudeGrassQuick5Controls.patchSpacing}
          windEnabled={claudeGrassQuick5Controls.windEnabled}
          windStrength={claudeGrassQuick5Controls.windStrength}
          windDirectionScale={claudeGrassQuick5Controls.windDirectionScale}
          windDirectionSpeed={claudeGrassQuick5Controls.windDirectionSpeed}
          windStrengthScale={claudeGrassQuick5Controls.windStrengthScale}
          windStrengthSpeed={claudeGrassQuick5Controls.windStrengthSpeed}
          playerInteractionEnabled={
            claudeGrassQuick5Controls.playerInteractionEnabled
          }
          playerInteractionRepel={
            claudeGrassQuick5Controls.playerInteractionRepel
          }
          playerInteractionRange={
            claudeGrassQuick5Controls.playerInteractionRange
          }
          playerInteractionStrength={
            claudeGrassQuick5Controls.playerInteractionStrength
          }
          playerInteractionHeightThreshold={
            claudeGrassQuick5Controls.playerInteractionHeightThreshold
          }
          baseColor1={claudeGrassQuick5Controls.baseColor1}
          baseColor2={claudeGrassQuick5Controls.baseColor2}
          tipColor1={claudeGrassQuick5Controls.tipColor1}
          tipColor2={claudeGrassQuick5Controls.tipColor2}
          gradientCurve={claudeGrassQuick5Controls.gradientCurve}
          aoEnabled={claudeGrassQuick5Controls.aoEnabled}
          aoIntensity={claudeGrassQuick5Controls.aoIntensity}
          fogEnabled={claudeGrassQuick5Controls.fogEnabled}
          fogNear={claudeGrassQuick5Controls.fogNear}
          fogFar={claudeGrassQuick5Controls.fogFar}
          fogIntensity={claudeGrassQuick5Controls.fogIntensity}
          fogColor={claudeGrassQuick5Controls.fogColor}
          specularEnabled={claudeGrassQuick5Controls.specularEnabled}
          specularIntensity={claudeGrassQuick5Controls.specularIntensity}
          specularColor={claudeGrassQuick5Controls.specularColor}
          specularDirectionX={claudeGrassQuick5Controls.specularDirectionX}
          specularDirectionY={claudeGrassQuick5Controls.specularDirectionY}
          specularDirectionZ={claudeGrassQuick5Controls.specularDirectionZ}
          grassMiddleBrightnessMin={
            claudeGrassQuick5Controls.grassMiddleBrightnessMin
          }
          grassMiddleBrightnessMax={
            claudeGrassQuick5Controls.grassMiddleBrightnessMax
          }
          backscatterEnabled={claudeGrassQuick5Controls.backscatterEnabled}
          backscatterIntensity={claudeGrassQuick5Controls.backscatterIntensity}
          backscatterColor={claudeGrassQuick5Controls.backscatterColor}
          backscatterPower={claudeGrassQuick5Controls.backscatterPower}
          frontScatterStrength={claudeGrassQuick5Controls.frontScatterStrength}
          rimSSSStrength={claudeGrassQuick5Controls.rimSSSStrength}
        />
      )}

      {/* Lens Flares */}
      {lensFlareEnabled && (
        <>
          {lensFlare1Enabled && (
            <LensFlare
              position={[
                lensFlare1Position.x,
                lensFlare1Position.y,
                lensFlare1Position.z,
              ]}
              h={lensFlare1H}
              s={lensFlare1S}
              l={lensFlare1L}
              intensity={lensFlare1Intensity}
              distance={flareDistance}
            />
          )}
          {lensFlare2Enabled && (
            <LensFlare
              position={[
                lensFlare2Position.x,
                lensFlare2Position.y,
                lensFlare2Position.z,
              ]}
              h={lensFlare2H}
              s={lensFlare2S}
              l={lensFlare2L}
              intensity={lensFlare2Intensity}
              distance={flareDistance}
            />
          )}
          {lensFlare3Enabled && (
            <LensFlare
              position={[
                lensFlare3Position.x,
                lensFlare3Position.y,
                lensFlare3Position.z,
              ]}
              h={lensFlare3H}
              s={lensFlare3S}
              l={lensFlare3L}
              intensity={lensFlare3Intensity}
              distance={flareDistance}
            />
          )}
        </>
      )}
    </group>
  );
};
