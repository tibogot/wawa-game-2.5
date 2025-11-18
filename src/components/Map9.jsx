import { useRef, useState, useCallback, useMemo, forwardRef } from "react";
import { useControls, folder } from "leva";
import * as THREE from "three";
import { ProceduralTerrain8 } from "./ProceduralTerrain8";
import { HeightFog } from "./HeightFog";
import { useHeightFogControls } from "./useHeightFogControls";
import { useLensFlareControls } from "./useLensFlareControls";
import LensFlare from "./LensFlare";
import { FloorDebugSpheres } from "./FloorDebugSpheres";
import { useFloorDebugSpheresControls } from "./useFloorDebugSpheresControls";
import { PhysicsDebugCubes } from "./PhysicsDebugCubes";

export const Map9 = forwardRef(
  (
    {
      scale = 1,
      position = [0, 0, 0],
      characterPosition,
      characterVelocity,
      onTerrainReady,
      ...props
    },
    ref
  ) => {
    const group = useRef(null);
    const [heightmapLookup, setHeightmapLookup] = useState(null);
    const [isTerrainMeshReady, setIsTerrainMeshReady] = useState(false);

    // Get Height Fog controls from hook
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

    // Get FloorDebugSpheres controls
    const {
      enabled: floorDebugSpheresEnabled,
      gridSize,
      areaSize,
      sphereSize,
      sphereColor,
      emissiveIntensity,
    } = useFloorDebugSpheresControls();

    // Get foliage controls (manual forest)
    const {
      forestEnabled,
      forestNumTrees,
      forestInnerRadius,
      forestOuterRadius,
      forestPositionX,
      forestPositionY,
      forestPositionZ,
    } = useControls("🌿 FOLIAGE", {
      forest: folder(
        {
          forestEnabled: {
            value: false,
            label: "🌲 Enable Forest",
          },
          forestNumTrees: {
            value: 100,
            min: 10,
            max: 500,
            step: 10,
            label: "🌳 Number of Trees",
          },
          forestInnerRadius: {
            value: 10,
            min: 0,
            max: 1000,
            step: 10,
            label: "📐 Inner Radius",
          },
          forestOuterRadius: {
            value: 50,
            min: 1,
            max: 1500,
            step: 10,
            label: "📐 Outer Radius",
          },
          forestPositionX: {
            value: 0,
            min: -1250,
            max: 1250,
            step: 10,
            label: "📍 Position X",
          },
          forestPositionY: {
            value: 0,
            min: -100,
            max: 100,
            step: 1,
            label: "📍 Position Y",
          },
          forestPositionZ: {
            value: 0,
            min: -1250,
            max: 1250,
            step: 10,
            label: "📍 Position Z",
          },
        },
        { collapsed: true }
      ),
    });

    // Get PhysicsDebugCubes controls
    const { physicsDebugCubesEnabled, physicsDebugCubesSpawnHeight } =
      useControls("🔧 DEBUG", {
        physicsDebugCubes: folder(
          {
            physicsDebugCubesEnabled: {
              value: false,
              label: "📦 Enable Physics Debug Cubes",
            },
            physicsDebugCubesSpawnHeight: {
              value: 20,
              min: 5,
              max: 50,
              step: 1,
              label: "⬆️ Spawn Height",
            },
          },
          { collapsed: true }
        ),
      });

    // Create stable fallback vectors
    const fallbackPosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);
    const fallbackVelocity = useMemo(() => new THREE.Vector3(0, 0, 0), []);

    // Callback when terrain heightmap is ready
    const handleHeightmapReady = useCallback((fn) => {
      console.log("✅ Map9 received heightmap lookup from terrain");
      setHeightmapLookup(() => fn);
      // Mark terrain mesh as ready after a short delay to ensure materials are compiled
      setTimeout(() => {
        setIsTerrainMeshReady(true);
        console.log("✅ Map9 terrain mesh ready, HeightFog can now apply");
      }, 100);
    }, []);

    // Ground height function - only works after heightmap is ready
    const getGroundHeight = useCallback(
      (x, z) => {
        if (!heightmapLookup) {
          return 0;
        }
        return heightmapLookup(x, z);
      },
      [heightmapLookup]
    );

    return (
      <group ref={group} {...props}>
        <ProceduralTerrain8
          onTerrainReady={onTerrainReady}
          onHeightmapReady={handleHeightmapReady}
        />

        {/* Only render HeightFog after terrain mesh is ready */}
        {isTerrainMeshReady && (
          <HeightFog
            enabled={heightFogEnabled}
            fogColor={fogColor}
            fogHeight={fogHeight}
            fogNear={fogNear}
            fogFar={fogFar}
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
        {/* Floor Debug Spheres - Visualize terrain height calculations */}
        {floorDebugSpheresEnabled && heightmapLookup && (
          <FloorDebugSpheres
            heightmapLookup={heightmapLookup}
            enabled={floorDebugSpheresEnabled}
            gridSize={gridSize}
            areaSize={areaSize}
            sphereSize={sphereSize}
            sphereColor={sphereColor}
            emissiveIntensity={emissiveIntensity}
          />
        )}
        {/* Physics Debug Cubes - Only render when terrain is ready */}
        {isTerrainMeshReady && (
          <PhysicsDebugCubes
            enabled={physicsDebugCubesEnabled}
            spawnHeight={physicsDebugCubesSpawnHeight}
          />
        )}
      </group>
    );
  }
);
