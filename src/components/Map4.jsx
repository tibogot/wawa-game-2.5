import React, { useEffect } from "react";
import { EnhancedProceduralTerrain } from "./EnhancedProceduralTerrain";

export const Map4 = ({ scale = 1, position = [0, 0, 0], onTerrainReady, ...props }) => {
  // Call onTerrainReady after terrain physics are initialized
  useEffect(() => {
    if (onTerrainReady) {
      // Delay to ensure EnhancedProceduralTerrain physics are fully initialized
      const timer = setTimeout(() => {
        onTerrainReady();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [onTerrainReady]);

  return (
    <EnhancedProceduralTerrain
      size={2000}
      segments={200}
      position={position}
      scale={scale}
      {...props}
    />
  );
};
