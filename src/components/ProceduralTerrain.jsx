import { useRef, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import { useControls } from "leva";

// Simple Perlin-like noise implementation
function createNoiseGenerator(seed = 0) {
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) {
    p[i] = i;
  }

  let random = seed;
  const seededRandom = () => {
    random = (random * 9301 + 49297) % 233280;
    return random / 233280;
  };

  for (let i = 255; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }

  for (let i = 0; i < 256; i++) {
    p[256 + i] = p[i];
  }

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  const grad = (hash, x, y) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  return (x, y) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = fade(x);
    const v = fade(y);

    const a = p[X] + Y;
    const aa = p[a];
    const ab = p[a + 1];
    const b = p[X + 1] + Y;
    const ba = p[b];
    const bb = p[b + 1];

    return lerp(
      v,
      lerp(u, grad(p[aa], x, y), grad(p[ba], x - 1, y)),
      lerp(u, grad(p[ab], x, y - 1), grad(p[bb], x - 1, y - 1))
    );
  };
}

// SHARED height calculation - THIS IS THE KEY TO SEAMLESS CHUNKS
function getTerrainHeight(worldX, worldZ, noiseGenerators, heightScale) {
  const { noise, noise2, noise3 } = noiseGenerators;

  // BASE TERRAIN
  const baseFreq = 0.0012;
  const base1 = noise(worldX * baseFreq, worldZ * baseFreq);
  const base2 = noise2(worldX * baseFreq * 0.7, worldZ * baseFreq * 0.7);
  const baseTerrain = (base1 * 0.6 + base2 * 0.4) * 1.8;

  // MOUNTAIN PEAKS
  const peakFreq = 0.002;
  const peaks = noise3(worldX * peakFreq, worldZ * peakFreq);
  const peakMask = Math.max(0, peaks * peaks * peaks * 2);

  // ROLLING HILLS
  const hillFreq = 0.005;
  const hills = noise(worldX * hillFreq + 100, worldZ * hillFreq + 100) * 0.6;

  // FINE DETAIL
  const detailFreq = 0.015;
  const detail =
    noise2(worldX * detailFreq + 50, worldZ * detailFreq + 50) * 0.25;

  // Combine
  let height = baseTerrain + peakMask + hills + detail;

  // Power curve
  const sign = height >= 0 ? 1 : -1;
  height = sign * Math.pow(Math.abs(height), 1.4);

  const finalHeight = height * heightScale;

  // Safety check - clamp height to prevent rendering issues
  if (!isFinite(finalHeight) || Math.abs(finalHeight) > 10000) {
    return 0;
  }

  return finalHeight;
}

// Single terrain chunk
function TerrainChunk({
  chunkX,
  chunkZ,
  chunkSize,
  segments,
  heightScale,
  noiseGenerators,
  lodLevel,
  showColorDebug,
  maxSegments,
  segmentsPerChunk,
  enableHeightGradient,
  lowColor,
  midColor,
  highColor,
  lowHeight,
  highHeight,
}) {
  const meshRef = useRef();

  const geometry = useMemo(() => {
    // Build geometry manually for perfect edge alignment
    const verticesPerSide = segments + 1;

    const positions = [];
    const indices = [];
    const uvs = [];
    const colors = [];

    // This chunk's ABSOLUTE world position
    const worldStartX = chunkX * chunkSize;
    const worldStartZ = chunkZ * chunkSize;

    const stepSize = chunkSize / segments;

    // Helper function to convert hex color to RGB
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255,
          }
        : { r: 1, g: 1, b: 1 };
    };

    // Convert colors to RGB
    const lowRgb = hexToRgb(lowColor);
    const midRgb = hexToRgb(midColor);
    const highRgb = hexToRgb(highColor);

    // Generate vertices at ABSOLUTE WORLD POSITIONS (not relative to chunk center)
    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        // Absolute world position of this vertex
        const worldX = worldStartX + x * stepSize;
        const worldZ = worldStartZ + z * stepSize;

        // Get height at this world position
        const height = getTerrainHeight(
          worldX,
          worldZ,
          noiseGenerators,
          heightScale
        );

        // Store as WORLD position (not local)
        positions.push(worldX, worldZ, height);
        uvs.push(x / segments, z / segments);

        // Calculate vertex color based on height
        if (enableHeightGradient) {
          // Normalize height between lowHeight and highHeight
          const normalizedHeight = Math.max(
            0,
            Math.min(1, (height - lowHeight) / (highHeight - lowHeight))
          );

          let r, g, b;

          if (normalizedHeight < 0.5) {
            // Interpolate between low and mid color
            const t = normalizedHeight * 2;
            r = lowRgb.r + (midRgb.r - lowRgb.r) * t;
            g = lowRgb.g + (midRgb.g - lowRgb.g) * t;
            b = lowRgb.b + (midRgb.b - lowRgb.b) * t;
          } else {
            // Interpolate between mid and high color
            const t = (normalizedHeight - 0.5) * 2;
            r = midRgb.r + (highRgb.r - midRgb.r) * t;
            g = midRgb.g + (highRgb.g - midRgb.g) * t;
            b = midRgb.b + (highRgb.b - midRgb.b) * t;
          }

          colors.push(r, g, b);
        } else {
          // Default white color
          colors.push(1, 1, 1);
        }
      }
    }

    // Generate indices for triangles
    for (let z = 0; z < segments; z++) {
      for (let x = 0; x < segments; x++) {
        const a = x + z * verticesPerSide;
        const b = x + (z + 1) * verticesPerSide;
        const c = x + 1 + (z + 1) * verticesPerSide;
        const d = x + 1 + z * verticesPerSide;

        indices.push(a, d, b); // Reversed
        indices.push(b, d, c); // Reversed
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [
    chunkX,
    chunkZ,
    chunkSize,
    segments,
    heightScale,
    noiseGenerators,
    lodLevel,
    enableHeightGradient,
    lowColor,
    midColor,
    highColor,
    lowHeight,
    highHeight,
  ]);

  const material = useMemo(() => {
    // Color coding for LOD levels
    let color = 0xffffff; // Default white

    if (showColorDebug) {
      // Calculate dynamic thresholds based on actual segmentsPerChunk
      // Green: 80%+ of segmentsPerChunk (high detail)
      // Yellow: 40-80% of segmentsPerChunk (medium detail)
      // Red: under 40% of segmentsPerChunk (low detail)
      const highThreshold = Math.floor(segmentsPerChunk * 0.8);
      const mediumThreshold = Math.floor(segmentsPerChunk * 0.4);

      if (lodLevel >= highThreshold) {
        color = 0x00ff00; // Green for high detail
      } else if (lodLevel >= mediumThreshold) {
        color = 0xffff00; // Yellow for medium detail
      } else {
        color = 0xff0000; // Red for low detail
      }
    }

    return new THREE.MeshStandardMaterial({
      color: color,
      flatShading: false,
      // side: THREE.DoubleSide,
      vertexColors: enableHeightGradient && !showColorDebug,
    });
  }, [lodLevel, showColorDebug, segmentsPerChunk, enableHeightGradient]);

  // NO POSITION - geometry is already in world space!
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        castShadow
      />
    </RigidBody>
  );
}

// Main terrain system
export const ProceduralTerrain = ({
  size = 2000,
  chunkSize = 500,
  segments = 512,
  heightScale = 75,
  seed = 18871,
  viewDistance = 1000,
  // LOD settings - optimized for 2000-unit map with 500-unit chunks
  lodNear = 400, // High detail within this distance (closer to chunk size)
  lodMedium = 800, // Medium detail within this distance
  lodFar = 1200, // Low detail beyond medium
}) => {
  const {
    terrainSize,
    terrainChunkSize,
    terrainSegments,
    terrainHeightScale,
    terrainSeed,
    terrainViewDistance,
    enableViewDistanceCulling,
    enableChunks,
    enableLOD,
    showColorDebug,
    terrainLodNear,
    terrainLodMedium,
    terrainLodFar,
    enableHeightGradient,
    lowColor,
    midColor,
    highColor,
    lowHeight,
    highHeight,
  } = useControls("🎮 Procedural Terrain", {
    terrainSize: {
      value: size,
      min: 500,
      max: 5000,
      step: 100,
      label: "World Size",
    },
    terrainChunkSize: {
      value: chunkSize,
      min: 100,
      max: 1000,
      step: 50,
      label: "Chunk Size",
    },
    terrainSegments: {
      value: segments,
      min: 20,
      max: 1024,
      step: 10,
      label: "Detail Segments",
    },
    terrainHeightScale: {
      value: heightScale,
      min: 10,
      max: 200,
      step: 5,
      label: "Height Scale",
    },
    terrainSeed: {
      value: seed,
      min: 0,
      max: 99999,
      step: 1,
      label: "Seed",
    },
    terrainViewDistance: {
      value: viewDistance,
      min: 500,
      max: 3000,
      step: 100,
      label: "View Distance",
    },
    enableViewDistanceCulling: {
      value: true,
      label: "Enable View Distance Culling",
    },
    enableChunks: {
      value: true,
      label: "Enable Chunks",
    },
    enableLOD: {
      value: false,
      label: "Enable LOD",
    },
    showColorDebug: {
      value: false,
      label: "Show LOD Colors",
    },
    terrainLodNear: {
      value: lodNear,
      min: 200,
      max: 1500,
      step: 50,
      label: "LOD Near",
    },
    terrainLodMedium: {
      value: lodMedium,
      min: 500,
      max: 2000,
      step: 50,
      label: "LOD Medium",
    },
    terrainLodFar: {
      value: lodFar,
      min: 1000,
      max: 3000,
      step: 50,
      label: "LOD Far",
    },
    enableHeightGradient: {
      value: true,
      label: "Enable Height Gradient",
    },
    lowColor: {
      value: "#2d5016", // Dark green for low areas
      label: "Low Height Color",
    },
    midColor: {
      value: "#8b4513", // Brown for mid areas
      label: "Mid Height Color",
    },
    highColor: {
      value: "#ffffff", // White for high areas
      label: "High Height Color",
    },
    lowHeight: {
      value: 0,
      min: -100,
      max: 100,
      step: 5,
      label: "Low Height Threshold",
    },
    highHeight: {
      value: 50,
      min: 0,
      max: 200,
      step: 5,
      label: "High Height Threshold",
    },
  });

  const { camera } = useThree();
  const [visibleChunks, setVisibleChunks] = useState(new Map()); // Now stores chunk + LOD level

  // Total chunks in grid
  const chunksPerSide = Math.ceil(terrainSize / terrainChunkSize);
  const halfSize = terrainSize / 2;

  // Create noise generators ONCE - shared by all chunks
  const noiseGenerators = useMemo(() => {
    return {
      noise: createNoiseGenerator(terrainSeed),
      noise2: createNoiseGenerator(terrainSeed + 1000),
      noise3: createNoiseGenerator(terrainSeed + 2000),
    };
  }, [terrainSeed]);

  // Calculate segments per chunk based on chunk size
  // Each chunk should have appropriate detail for its size
  const segmentsPerChunk = Math.max(
    10,
    Math.floor((terrainSegments * terrainChunkSize) / terrainSize)
  );

  // Debug logging
  console.log(`Terrain Debug:
    - Total size: ${terrainSize}
    - Chunk size: ${terrainChunkSize}
    - Chunks per side: ${chunksPerSide}
    - Total chunks: ${chunksPerSide * chunksPerSide}
    - Base segments: ${terrainSegments}
    - Segments per chunk: ${segmentsPerChunk}
    - Triangles per chunk: ${segmentsPerChunk * segmentsPerChunk * 2}
    - Visible chunks: ${visibleChunks.size}
    - Total triangles (chunks): ${
      visibleChunks.size * segmentsPerChunk * segmentsPerChunk * 2
    }
    - Total triangles (single): ${terrainSegments * terrainSegments * 2}`);

  // Get LOD segments based on distance - MUST BE DIVISIBLE TO MAINTAIN SEAMS
  const getLODSegments = (distance) => {
    // If LOD is disabled, use base chunk segments
    if (!enableLOD) return segmentsPerChunk;

    if (distance < terrainLodNear) return segmentsPerChunk; // High detail
    if (distance < terrainLodMedium) return Math.floor(segmentsPerChunk / 2); // Medium (half segments)
    return Math.floor(segmentsPerChunk / 4); // Low (quarter segments)
  };

  // Update visible chunks based on camera
  useFrame(() => {
    // Skip chunk/LOD logic if chunks are disabled
    if (!enableChunks) {
      // Clear chunks state when disabled
      if (visibleChunks.size > 0) {
        setVisibleChunks(new Map());
      }
      return;
    }

    const cameraPos = camera.position;
    const newVisibleChunks = new Map();

    for (let x = 0; x < chunksPerSide; x++) {
      for (let z = 0; z < chunksPerSide; z++) {
        // Chunk bounds in world space
        const chunkMinX = x * terrainChunkSize - halfSize;
        const chunkMaxX = chunkMinX + terrainChunkSize;
        const chunkMinZ = z * terrainChunkSize - halfSize;
        const chunkMaxZ = chunkMinZ + terrainChunkSize;

        // Distance to NEAREST POINT on chunk (not center!)
        const nearestX = Math.max(chunkMinX, Math.min(cameraPos.x, chunkMaxX));
        const nearestZ = Math.max(chunkMinZ, Math.min(cameraPos.z, chunkMaxZ));

        const dx = cameraPos.x - nearestX;
        const dz = cameraPos.z - nearestZ;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Only cull chunks beyond view distance if culling is enabled
        if (!enableViewDistanceCulling || distance < terrainViewDistance) {
          const lodLevel = getLODSegments(distance);
          const chunkKey = `${x},${z}`;
          newVisibleChunks.set(chunkKey, { x, z, lodLevel, distance });
        }
      }
    }

    // Check if chunks or LOD levels changed
    let needsUpdate = newVisibleChunks.size !== visibleChunks.size;

    if (!needsUpdate) {
      for (const [key, value] of newVisibleChunks) {
        const old = visibleChunks.get(key);
        if (!old || old.lodLevel !== value.lodLevel) {
          needsUpdate = true;
          break;
        }
      }
    }

    if (needsUpdate) {
      setVisibleChunks(newVisibleChunks);
    }
  });

  // Render single large terrain if chunks are disabled
  if (!enableChunks) {
    return (
      <group>
        <TerrainChunk
          key="single-terrain"
          chunkX={-0.5}
          chunkZ={-0.5}
          chunkSize={terrainSize}
          segments={terrainSegments}
          heightScale={terrainHeightScale}
          noiseGenerators={noiseGenerators}
          lodLevel={terrainSegments}
          showColorDebug={showColorDebug}
          maxSegments={terrainSegments}
          segmentsPerChunk={terrainSegments}
          enableHeightGradient={enableHeightGradient}
          lowColor={lowColor}
          midColor={midColor}
          highColor={highColor}
          lowHeight={lowHeight}
          highHeight={highHeight}
        />
      </group>
    );
  }

  return (
    <group>
      {Array.from(visibleChunks.values()).map((chunkData) => {
        const { x, z, lodLevel } = chunkData;

        // Convert to centered coordinates
        const chunkX = x - Math.floor(chunksPerSide / 2);
        const chunkZ = z - Math.floor(chunksPerSide / 2);

        const chunkKey = `${x},${z}`;

        return (
          <TerrainChunk
            key={`${chunkKey}`}
            chunkX={chunkX}
            chunkZ={chunkZ}
            chunkSize={terrainChunkSize}
            segments={lodLevel}
            heightScale={terrainHeightScale}
            noiseGenerators={noiseGenerators}
            lodLevel={lodLevel}
            showColorDebug={showColorDebug}
            maxSegments={terrainSegments}
            segmentsPerChunk={segmentsPerChunk}
            enableHeightGradient={enableHeightGradient}
            lowColor={lowColor}
            midColor={midColor}
            highColor={highColor}
            lowHeight={lowHeight}
            highHeight={highHeight}
          />
        );
      })}
    </group>
  );
};
