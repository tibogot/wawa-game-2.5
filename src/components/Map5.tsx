import React, { useMemo, useState, useCallback } from "react";
import { useControls, folder } from "leva";
import { Clouds, Cloud } from "@react-three/drei";
import ZeldaTerrain2 from "./ZeldaTerrain2";
import { HeightFog } from "./HeightFog";
import { useHeightFogControls } from "./useHeightFogControls";
import { useLensFlareControls } from "./useLensFlareControls";
import LensFlare from "./LensFlare";
import { FloorDebugSpheres } from "./FloorDebugSpheres";
import { useFloorDebugSpheresControls } from "./useFloorDebugSpheresControls";
import * as THREE from "three";

export const Map5 = ({
  scale = 1,
  position = [0, 0, 0] as [number, number, number],
  characterPosition,
  characterVelocity,
  onTerrainReady,
  ...props
}: any) => {
  // State to hold the heightmap lookup function from ZeldaTerrain2
  const [heightmapLookup, setHeightmapLookup] = useState<
    ((x: number, z: number) => number) | null
  >(null);

  // Create stable fallback vectors (same as Map3)
  const fallbackPosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const fallbackVelocity = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Function to get terrain height using ZeldaTerrain2's lookup
  const getTerrainHeight = useMemo(() => {
    return (x: number, z: number): number => {
      if (heightmapLookup) {
        return heightmapLookup(x, z);
      }
      return 0; // Fallback if lookup not ready
    };
  }, [heightmapLookup]);

  // Callback when ZeldaTerrain2 is ready
  const handleHeightmapReady = useCallback(
    (fn: (x: number, z: number) => number) => {
      setHeightmapLookup(() => fn);
      if (onTerrainReady) {
        onTerrainReady();
      }
    },
    [onTerrainReady]
  );

  // Get Height Fog controls from hook
  const { heightFogEnabled, fogColor, fogHeight, fogNear, fogFar } =
    useHeightFogControls();

  const {
    enabled,
    cloudPosition,
    cloudScale,
    cloudSegments,
    bounds,
    concentrate,
    cloudVolume,
    smallestVolume,
    cloudFade,
    cloudOpacity,
    cloudColor,
    speed,
    growth,
    cloudSeed,
    cloudsLimit,
    cloudsRange,
    frustumCulled,
    rainEnabled,
    rainDensity,
    rainAreaSize,
    rainHeight,
    rainSpeed,
    rainParticleSize,
    rainColor,
    rainOpacity,
  } = useControls("🌤️ AMBIENCE", {
    clouds: folder(
      {
        enabled: { value: false, label: "☁️ Enable Clouds" },
        cloudPosition: {
          value: [0, 800, 0],
          label: "Position",
          step: 50,
        },
        cloudScale: {
          value: [1, 1, 1],
          label: "Scale",
          step: 0.1,
        },
        bounds: {
          value: [10, 2, 2],
          label: "Bounds",
          step: 1,
        },
        cloudSegments: {
          value: 40,
          label: "Segments",
          min: 10,
          max: 100,
          step: 5,
        },
        concentrate: {
          value: "inside" as "random" | "inside" | "outside",
          label: "Concentrate",
          options: ["random", "inside", "outside"],
        },
        cloudVolume: {
          value: 8,
          label: "Volume",
          min: 1,
          max: 20,
          step: 1,
        },
        smallestVolume: {
          value: 0.25,
          label: "Smallest Volume",
          min: 0.1,
          max: 1,
          step: 0.05,
        },
        cloudFade: {
          value: 10,
          label: "Fade Distance",
          min: 0,
          max: 50,
          step: 1,
        },
        cloudOpacity: {
          value: 1,
          label: "Opacity",
          min: 0,
          max: 1,
          step: 0.1,
        },
        cloudColor: {
          value: "#ffffff",
          label: "Color",
        },
        speed: {
          value: 0,
          label: "Animation Speed",
          min: 0,
          max: 2,
          step: 0.1,
        },
        growth: {
          value: 4,
          label: "Growth Factor",
          min: 1,
          max: 10,
          step: 0.5,
        },
        cloudSeed: {
          value: 0,
          label: "Seed",
          min: 0,
          max: 1000,
          step: 1,
        },
        cloudsLimit: {
          value: 200,
          label: "Clouds Limit",
          min: 50,
          max: 500,
          step: 10,
        },
        cloudsRange: {
          value: 200,
          label: "Clouds Range (200 = all)",
          min: 0,
          max: 200,
          step: 10,
        },
        frustumCulled: {
          value: true,
          label: "Frustum Culled",
        },
      },
      { collapsed: true }
    ),
    rainParticles: folder(
      {
        rainEnabled: { value: false, label: "💧 Enable Rain" },
        rainDensity: {
          value: 500,
          label: "Density",
          min: 100,
          max: 2000,
          step: 50,
        },
        rainAreaSize: {
          value: 50.0,
          label: "Area Size",
          min: 20,
          max: 200,
          step: 10,
        },
        rainHeight: {
          value: 20.0,
          label: "Rain Height",
          min: 5,
          max: 100,
          step: 5,
        },
        rainSpeed: {
          value: 8.0,
          label: "Fall Speed",
          min: 2,
          max: 20,
          step: 1,
        },
        rainParticleSize: {
          value: 0.01,
          label: "Particle Size",
          min: 0.005,
          max: 0.05,
          step: 0.001,
        },
        rainColor: {
          value: "#d0e0ff",
          label: "Rain Color",
        },
        rainOpacity: {
          value: 0.4,
          label: "Opacity",
          min: 0.1,
          max: 1.0,
          step: 0.05,
        },
      },
      { collapsed: true }
    ),
  });

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

  return (
    <group>
      <HeightFog
        enabled={heightFogEnabled}
        fogColor={fogColor}
        fogHeight={fogHeight}
        fogNear={fogNear}
        fogFar={fogFar}
      />
      <ZeldaTerrain2 onHeightmapReady={handleHeightmapReady}       />
      {enabled && (
        <Clouds
          limit={cloudsLimit}
          range={cloudsRange === 200 ? undefined : cloudsRange}
          frustumCulled={frustumCulled}
        >
          <Cloud
            position={cloudPosition}
            scale={cloudScale}
            bounds={bounds}
            segments={cloudSegments}
            concentrate={concentrate as "random" | "inside" | "outside"}
            volume={cloudVolume}
            smallestVolume={smallestVolume}
            fade={cloudFade}
            color={cloudColor}
            opacity={cloudOpacity}
            speed={speed}
            growth={growth}
            seed={cloudSeed}
          />
        </Clouds>
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
    </group>
  );
};
