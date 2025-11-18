import React, { forwardRef } from "react";
import { ProceduralTerrain5 } from "./ProceduralTerrain5";

export const Map12 = forwardRef<any, any>(
  (
    {
      scale = 1,
      position = [0, 0, 0] as [number, number, number],
      characterPosition,
      characterVelocity,
      onTerrainReady,
      ...props
    },
    ref
  ) => {
    const handleTerrainReady = () => {
      if (onTerrainReady) {
        onTerrainReady();
      }
    };

    const handleHeightmapReady = (getHeightFn: (x: number, z: number) => number) => {
      // Heightmap ready callback if needed
    };

    return (
      <group>
        <ProceduralTerrain5
          onTerrainReady={handleTerrainReady}
          onHeightmapReady={handleHeightmapReady}
        />
      </group>
    );
  }
);

