import * as THREE from "three";

/**
 * Terrain utilities for height calculation and smart spawning
 */

/**
 * Calculate terrain height at a specific X,Z position using raycasting
 * @param x - World X coordinate
 * @param z - World Z coordinate
 * @param terrainMesh - The terrain mesh to raycast against
 * @param defaultHeight - Fallback height if raycast fails
 * @param raycastHeight - Height to start raycast from (default: 200)
 * @returns The Y coordinate where the terrain is located
 */
export function getTerrainHeight(
  x: number,
  z: number,
  terrainMesh: THREE.Mesh | null | undefined,
  defaultHeight: number = 0,
  raycastHeight: number = 200
): number {
  if (!terrainMesh) {
    return defaultHeight;
  }

  // Raycast from above to find terrain height
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(x, raycastHeight, z); // Start high above
  const direction = new THREE.Vector3(0, -1, 0); // Point down

  raycaster.set(origin, direction);

  const intersects = raycaster.intersectObject(terrainMesh, false);

  if (intersects.length > 0) {
    const terrainY = intersects[0].point.y;
    return terrainY;
  }

  return defaultHeight;
}

/**
 * Calculate a safe spawn position above the terrain
 * @param x - Desired X coordinate
 * @param z - Desired Z coordinate
 * @param terrainMesh - The terrain mesh to check against
 * @param spawnHeightOffset - How high above terrain to spawn (default: 5)
 * @param defaultHeight - Fallback height if raycast fails (default: 10)
 * @returns Position array [x, y, z] with calculated Y
 */
export function getSafeSpawnPosition(
  x: number,
  z: number,
  terrainMesh: THREE.Mesh | null | undefined,
  spawnHeightOffset: number = 5,
  defaultHeight: number = 10
): [number, number, number] {
  const terrainHeight = getTerrainHeight(x, z, terrainMesh, defaultHeight);
  const spawnY = terrainHeight + spawnHeightOffset;

  return [x, spawnY, z];
}

/**
 * Calculate terrain height using heightmap data directly (more efficient for batch operations)
 * This is an alternative to raycasting that works directly with the heightmap texture
 * @param x - World X coordinate
 * @param z - World Z coordinate
 * @param heightmapTexture - The heightmap texture (can be null for fallback)
 * @param size - Size of the terrain
 * @param heightScale - Height scale multiplier
 * @param terrainOffset - Y offset applied to terrain
 * @returns The Y coordinate of the terrain at this position
 */
export function getTerrainHeightFromTexture(
  x: number,
  z: number,
  heightmapTexture: THREE.Texture | null,
  size: number,
  heightScale: number,
  terrainOffset: number = -50
): number {
  // For now, let's use a simple fallback calculation
  // This assumes the terrain is roughly flat with some variation

  // Simple height calculation based on distance from center
  const distanceFromCenter = Math.sqrt(x * x + z * z);
  const maxDistance = size / 2;
  const normalizedDistance = Math.min(distanceFromCenter / maxDistance, 1);

  // Create some height variation (higher at edges, lower in center)
  const heightVariation =
    Math.sin(normalizedDistance * Math.PI) * heightScale * 0.3;

  // With terrain peak at Y=0 (terrainOffset = 0), the base should be at terrainOffset
  // Terrain goes from terrainOffset (lowest) to terrainOffset + heightScale (highest)
  // Since peak is at center (Y=0), we use terrainOffset as base
  const baseHeight = terrainOffset; // Peak is at Y=0, so base is also at 0

  const finalHeight = baseHeight + heightVariation;

  return finalHeight;
}

/**
 * Batch calculate spawn positions for multiple objects
 * @param positions - Array of [x, z] coordinates
 * @param terrainMesh - The terrain mesh to check against
 * @param spawnHeightOffset - How high above terrain to spawn
 * @returns Array of [x, y, z] positions
 */
export function getBatchSpawnPositions(
  positions: [number, number][],
  terrainMesh: THREE.Mesh | null | undefined,
  spawnHeightOffset: number = 5
): [number, number, number][] {
  return positions.map(([x, z]) =>
    getSafeSpawnPosition(x, z, terrainMesh, spawnHeightOffset)
  );
}
