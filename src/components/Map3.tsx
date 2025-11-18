import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useControls } from "leva";
import { HeightMapUnreal } from "./HeightMapUnreal";
import { HeightFog } from "./HeightFog";
import { useHeightFogControls } from "./useHeightFogControls";
import * as THREE from "three";

export const Map3 = ({
  scale = 1,
  position = [0, 0, 0] as [number, number, number],
  characterPosition,
  characterVelocity,
  onTerrainReady,
  ...props
}: any) => {
  // State to hold the heightmap lookup function from HeightMapUnreal (SAME pattern as Map5!)
  const [heightmapLookup, setHeightmapLookup] = useState<
    ((x: number, z: number) => number) | null
  >(null);

  // Callback when HeightMapUnreal is ready (SAME pattern as Map5!)
  const handleHeightmapReady = useCallback(
    (fn: (x: number, z: number) => number) => {
      console.log("✅ Map3: Received heightmap lookup from HeightMapUnreal");
      setHeightmapLookup(() => fn);
    },
    []
  );

  // Function to get terrain height using HeightMapUnreal's lookup (SAME pattern as Map5!)
  const getTerrainHeight = useMemo(() => {
    return (x: number, z: number): number => {
      if (heightmapLookup) {
        return heightmapLookup(x, z);
      }
      return 0; // Fallback if lookup not ready
    };
  }, [heightmapLookup]);

  // Create stable fallback vectors
  const fallbackPosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const fallbackVelocity = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Get heightFog controls from separate hook
  const { heightFogEnabled, fogColor, fogHeight, fogNear, fogFar } =
    useHeightFogControls();

  const terrainMeshRef = useRef<THREE.Mesh>(null!);

  // Call onTerrainReady after terrain physics are initialized
  useEffect(() => {
    if (onTerrainReady) {
      // Delay to ensure HeightMapUnreal RigidBody physics are fully initialized
      const timer = setTimeout(() => {
        onTerrainReady();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [onTerrainReady]);

  return (
    <group>
      <HeightFog
        enabled={heightFogEnabled}
        fogColor={fogColor}
        fogHeight={fogHeight}
        fogNear={fogNear}
        fogFar={fogFar}
      />
      <HeightMapUnreal
        ref={terrainMeshRef}
        size={4000}
        segments={200}
        heightScale={200}
        position={position}
        scale={scale}
        onHeightmapReady={handleHeightmapReady}
        {...props}
      />
    </group>
  );
};
