import React, {
  useRef,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import * as THREE from "three";
import { ProceduralTerrain2 } from "./ProceduralTerrain2";
export const Map7 = ({
  scale = 1,
  position = [0, 0, 0],
  characterPosition,
  characterVelocity,
  onTerrainReady,
  ...props
}) => {
  const group = useRef<THREE.Group>(null);

  // State to hold the heightmap lookup function from ProceduralTerrain2
  const [heightmapLookup, setHeightmapLookup] = useState<
    ((x: number, z: number) => number) | null
  >(null);

  // Create stable fallback vectors
  const fallbackPosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Callback when ProceduralTerrain2 heightmap is ready
  const handleHeightmapReady = useCallback(
    (fn: (x: number, z: number) => number) => {
      console.log("✅ Map7 received heightmap lookup from ProceduralTerrain2");
      setHeightmapLookup(() => fn);
    },
    []
  );

  // Function to get terrain height using ProceduralTerrain2's lookup
  const getGroundHeight = useMemo(() => {
    return (x: number, z: number): number => {
      if (heightmapLookup) {
        return heightmapLookup(x, z);
      }
      return 0; // Fallback if lookup not ready
    };
  }, [heightmapLookup]);

  // Call onTerrainReady after terrain physics are initialized
  useEffect(() => {
    if (onTerrainReady) {
      // Delay to ensure ProceduralTerrain2 physics are fully initialized
      const timer = setTimeout(() => {
        onTerrainReady();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [onTerrainReady]);

  return (
    <group ref={group} {...props}>
      {/* Procedural Terrain 2 */}
      <ProceduralTerrain2 onHeightmapReady={handleHeightmapReady} />
    </group>
  );
};
