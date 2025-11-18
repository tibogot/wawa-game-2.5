import { useEffect } from "react";
import { ProceduralTerrain } from "./ProceduralTerrain";

export const Map2 = ({ scale = 1, position = [0, 0, 0], onTerrainReady, ...props }) => {
  // Call onTerrainReady after terrain physics are initialized
  useEffect(() => {
    if (onTerrainReady) {
      // Delay to ensure ProceduralTerrain physics are fully initialized
      const timer = setTimeout(() => {
        onTerrainReady();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [onTerrainReady]);

  return (
    <group {...props}>
      <ProceduralTerrain />
    </group>
  );
};
