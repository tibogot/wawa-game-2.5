import React, { useMemo } from "react";

interface FloorDebugSpheresProps {
  heightmapLookup: ((x: number, z: number) => number) | null;
  enabled?: boolean;
  gridSize?: number;
  areaSize?: number;
  sphereSize?: number;
  sphereColor?: string;
  emissiveIntensity?: number;
}

export const FloorDebugSpheres = ({
  heightmapLookup,
  enabled = true,
  gridSize = 15,
  areaSize = 500,
  sphereSize = 3,
  sphereColor = "#00ff00",
  emissiveIntensity = 0.8,
}: FloorDebugSpheresProps) => {
  // Generate sphere positions using heightmap lookup
  const spheres = useMemo(() => {
    if (!enabled || !heightmapLookup) {
      console.log("🔴 FloorDebugSpheres: Not enabled or no heightmapLookup", {
        enabled,
        hasHeightmap: !!heightmapLookup,
      });
      return [];
    }

    const positions: Array<[number, number, number]> = [];
    const halfGrid = Math.floor(gridSize / 2);
    const spacing = areaSize / gridSize;

    for (let x = -halfGrid; x <= halfGrid; x++) {
      for (let z = -halfGrid; z <= halfGrid; z++) {
        const worldX = x * spacing;
        const worldZ = z * spacing;

        // Use heightmap lookup to get terrain height
        const terrainHeight = heightmapLookup(worldX, worldZ);

        positions.push([worldX, terrainHeight, worldZ]);
      }
    }

    console.log(`✅ FloorDebugSpheres: Generated ${positions.length} spheres`);
    return positions;
  }, [enabled, heightmapLookup, gridSize, areaSize]);

  if (!enabled || !heightmapLookup || spheres.length === 0) {
    return null;
  }

  return (
    <group>
      {spheres.map((position, index) => (
        <mesh key={index} position={position} castShadow receiveShadow>
          <sphereGeometry args={[sphereSize, 16, 16]} />
          <meshStandardMaterial
            color={sphereColor}
            emissive={sphereColor}
            emissiveIntensity={emissiveIntensity}
            metalness={0.1}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
};
