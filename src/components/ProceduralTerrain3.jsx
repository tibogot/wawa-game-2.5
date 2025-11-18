import { useRef, useMemo, useState, useEffect } from "react";
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
function getTerrainHeight(
  worldX,
  worldZ,
  noiseGenerators,
  heightScale,
  terrainControls = {}
) {
  const { noise, noise2, noise3, noise4 } = noiseGenerators;

  // Extract controls with defaults
  const {
    mountainIntensity = 1.0,
    flatnessThreshold = 0.3,
    flatnessSmooth = 0.2,
    ridgeSharpness = 2.0,
    valleyDepth = 0.3,
    detailAmount = 0.15,
  } = terrainControls;

  // === REGION MASK - Determines where mountains vs flat areas are ===
  const regionFreq = 0.0008; // Very low frequency for large regions
  const regionNoise = noise(worldX * regionFreq, worldZ * regionFreq);
  const regionNoise2 = noise2(
    worldX * regionFreq * 1.3 + 500,
    worldZ * regionFreq * 1.3 + 500
  );
  const regionMask = (regionNoise * 0.6 + regionNoise2 * 0.4) * 0.5 + 0.5; // 0 to 1

  // Create flat zones - areas where regionMask is below threshold become flat
  let flatnessFactor = 1.0;
  if (regionMask < flatnessThreshold) {
    // Smooth transition to flat
    flatnessFactor =
      Math.pow(regionMask / flatnessThreshold, 2) * flatnessSmooth +
      (1 - flatnessSmooth);
  }

  // === RIDGED NOISE for sharp mountain peaks ===
  const ridgeFreq = 0.0015;
  let ridge1 = Math.abs(noise3(worldX * ridgeFreq, worldZ * ridgeFreq));
  ridge1 = 1 - ridge1; // Invert to create ridges
  ridge1 = Math.pow(ridge1, ridgeSharpness); // Sharpen the ridges

  let ridge2 = Math.abs(
    noise4(worldX * ridgeFreq * 2 + 1000, worldZ * ridgeFreq * 2 + 1000)
  );
  ridge2 = 1 - ridge2;
  ridge2 = Math.pow(ridge2, ridgeSharpness * 0.8);

  const ridgeTerrain = (ridge1 * 0.7 + ridge2 * 0.3) * mountainIntensity;

  // === BASE TERRAIN - Gentle large-scale variation ===
  const baseFreq = 0.0006;
  const base1 = noise(worldX * baseFreq + 2000, worldZ * baseFreq + 2000);
  const base2 = noise2(
    worldX * baseFreq * 0.5 + 3000,
    worldZ * baseFreq * 0.5 + 3000
  );
  const baseTerrain = (base1 * 0.6 + base2 * 0.4) * 0.5;

  // === VALLEYS - Negative features ===
  const valleyFreq = 0.001;
  const valleyNoise = noise3(
    worldX * valleyFreq + 4000,
    worldZ * valleyFreq + 4000
  );
  const valleys = Math.min(0, valleyNoise * valleyDepth);

  // === SUBTLE DETAIL - Only applied in non-flat areas ===
  const detailFreq = 0.008;
  const detail =
    noise2(worldX * detailFreq, worldZ * detailFreq) * detailAmount;

  // === COMBINE LAYERS ===
  // Mountain regions get ridges, flat regions stay mostly flat
  const mountainMask = Math.pow(
    Math.max(0, regionMask - flatnessThreshold),
    1.5
  );
  const mountainHeight = ridgeTerrain * mountainMask;

  let height = baseTerrain + mountainHeight + valleys + detail * flatnessFactor;

  // Apply flatness factor to reduce all variation in flat areas
  height = height * flatnessFactor;

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
  enableSlopeColoring,
  enableColorNoise,
  colorNoiseScale,
  enableTextureNoise,
  textureNoiseScale,
  textureFrequency,
  valleyColor,
  grassColor,
  mountainColor,
  peakColor,
  cliffColor,
  slopeThreshold,
  terrainControls,
  enableAO,
  aoIntensity,
  aoRadius,
  aoEdgeFade,
}) {
  const meshRef = useRef();
  const heightMapRef = useRef(null);

  // Step 1: Generate base geometry (positions, indices, uvs) - only when terrain shape changes
  const geometry = useMemo(() => {
    // Build geometry manually for perfect edge alignment
    const verticesPerSide = segments + 1;

    const positions = [];
    const indices = [];
    const uvs = [];

    // This chunk's ABSOLUTE world position
    const worldStartX = chunkX * chunkSize;
    const worldStartZ = chunkZ * chunkSize;

    const stepSize = chunkSize / segments;

    // Generate heightmap and store in ref for later use
    const heightMap = [];
    for (let z = 0; z <= segments; z++) {
      heightMap[z] = [];
      for (let x = 0; x <= segments; x++) {
        const worldX = worldStartX + x * stepSize;
        const worldZ = worldStartZ + z * stepSize;
        const height = getTerrainHeight(
          worldX,
          worldZ,
          noiseGenerators,
          heightScale,
          terrainControls
        );
        heightMap[z][x] = height;
      }
    }

    // Store heightmap for color/AO updates
    heightMapRef.current = heightMap;

    // Generate vertices with positions and UVs
    // Colors will be calculated separately in useEffect
    const colors = [];
    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const height = heightMap[z][x];

        // Store as WORLD position (not local)
        const worldX = worldStartX + x * stepSize;
        const worldZ = worldStartZ + z * stepSize;
        positions.push(worldX, worldZ, height);
        uvs.push(x / segments, z / segments);

        // Initialize with white color (will be updated by useEffect)
        colors.push(1, 1, 1);
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
    terrainControls,
    // Note: Color and AO params intentionally NOT in dependencies
    // They are captured in closure but won't trigger regeneration
    // Geometry only regenerates when terrain SHAPE changes
  ]);

  // Step 2: Update colors when color/AO settings change (without regenerating geometry)
  useEffect(() => {
    if (!geometry || !heightMapRef.current) return;

    const heightMap = heightMapRef.current;
    const colors = [];

    // Helper function to convert hex color to RGB with sRGB to Linear conversion
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return { r: 1, g: 1, b: 1 };

      // Parse hex values (0-255)
      const r_srgb = parseInt(result[1], 16) / 255;
      const g_srgb = parseInt(result[2], 16) / 255;
      const b_srgb = parseInt(result[3], 16) / 255;

      // Convert from sRGB to Linear color space
      // This is the key! Vertex colors need to be in linear space
      const srgbToLinear = (c) => {
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };

      return {
        r: srgbToLinear(r_srgb),
        g: srgbToLinear(g_srgb),
        b: srgbToLinear(b_srgb),
      };
    };

    // Convert all terrain colors to RGB
    const valleyRgb = hexToRgb(valleyColor);
    const grassRgb = hexToRgb(grassColor);
    const mountainRgb = hexToRgb(mountainColor);
    const peakRgb = hexToRgb(peakColor);
    const cliffRgb = hexToRgb(cliffColor);

    // Get world start positions for noise calculation
    const worldStartX = chunkX * chunkSize;
    const worldStartZ = chunkZ * chunkSize;
    const stepSize = chunkSize / segments;

    // Helper function to calculate slope at a vertex
    const calculateSlope = (x, z) => {
      if (!enableSlopeColoring) return 0;

      // Get neighboring heights to calculate slope
      const h_center = heightMap[z][x];
      const h_left = x > 0 ? heightMap[z][x - 1] : h_center;
      const h_right = x < segments ? heightMap[z][x + 1] : h_center;
      const h_down = z > 0 ? heightMap[z - 1][x] : h_center;
      const h_up = z < segments ? heightMap[z + 1][x] : h_center;

      // Calculate gradients in x and z directions
      const dx = (h_right - h_left) / (2 * stepSize);
      const dz = (h_up - h_down) / (2 * stepSize);

      // Slope magnitude
      const slope = Math.sqrt(dx * dx + dz * dz);
      return slope;
    };

    // Helper function to calculate curvature-based AO at a vertex
    const calculateAO = (x, z) => {
      if (!enableAO) return 1.0;

      const edgeDistX = Math.min(x, segments - x) / segments;
      const edgeDistZ = Math.min(z, segments - z) / segments;
      const minEdgeDist = Math.min(edgeDistX, edgeDistZ);

      let edgeFadeFactor = 1.0;
      if (minEdgeDist < aoEdgeFade) {
        edgeFadeFactor = Math.pow(minEdgeDist / aoEdgeFade, 2);
      }

      const centerHeight = heightMap[z][x];
      let totalOcclusion = 0;
      let sampleCount = 0;

      for (let dz = -aoRadius; dz <= aoRadius; dz++) {
        for (let dx = -aoRadius; dx <= aoRadius; dx++) {
          if (dx === 0 && dz === 0) continue;

          const nx = x + dx;
          const nz = z + dz;

          if (nx >= 0 && nx <= segments && nz >= 0 && nz <= segments) {
            const neighborHeight = heightMap[nz][nx];
            const distance = Math.sqrt(dx * dx + dz * dz);
            const heightDiff = neighborHeight - centerHeight;

            if (heightDiff > 0) {
              const normalizedDiff = heightDiff / (heightScale * 0.3);
              const distanceFalloff = Math.max(0, 1.0 - distance / aoRadius);
              const occlusion = Math.pow(normalizedDiff * distanceFalloff, 0.7);
              totalOcclusion += Math.max(0, Math.min(1, occlusion));
            }

            sampleCount++;
          }
        }
      }

      const avgOcclusion = sampleCount > 0 ? totalOcclusion / sampleCount : 0;
      const ao =
        1.0 - Math.pow(avgOcclusion, 0.8) * aoIntensity * edgeFadeFactor;
      return Math.max(0.2, Math.min(1.0, ao));
    };

    // Recalculate colors for all vertices
    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const height = heightMap[z][x];
        const aoFactor = calculateAO(x, z);

        let r, g, b;

        if (enableHeightGradient || enableSlopeColoring) {
          // Calculate slope
          const slope = calculateSlope(x, z);

          // Normalize height (0 to 1) - use dynamic range based on actual terrain
          const minHeight = -heightScale * 0.3;
          const maxHeight = heightScale * 0.7;
          const heightNorm = Math.max(
            0,
            Math.min(1, (height - minHeight) / (maxHeight - minHeight))
          );

          // Calculate base color from height gradient
          let baseColor = { r: 0.5, g: 0.5, b: 0.5 };

          if (enableHeightGradient) {
            // 4-stop gradient: valley → grass → mountain → peak
            if (heightNorm < 0.33) {
              // Valley to grass
              const t = heightNorm / 0.33;
              baseColor.r = valleyRgb.r + (grassRgb.r - valleyRgb.r) * t;
              baseColor.g = valleyRgb.g + (grassRgb.g - valleyRgb.g) * t;
              baseColor.b = valleyRgb.b + (grassRgb.b - valleyRgb.b) * t;
            } else if (heightNorm < 0.66) {
              // Grass to mountain
              const t = (heightNorm - 0.33) / 0.33;
              baseColor.r = grassRgb.r + (mountainRgb.r - grassRgb.r) * t;
              baseColor.g = grassRgb.g + (mountainRgb.g - grassRgb.g) * t;
              baseColor.b = grassRgb.b + (mountainRgb.b - grassRgb.b) * t;
            } else {
              // Mountain to peak
              const t = (heightNorm - 0.66) / 0.34;
              baseColor.r = mountainRgb.r + (peakRgb.r - mountainRgb.r) * t;
              baseColor.g = mountainRgb.g + (peakRgb.g - mountainRgb.g) * t;
              baseColor.b = mountainRgb.b + (peakRgb.b - mountainRgb.b) * t;
            }
          } else {
            baseColor = { r: 1, g: 1, b: 1 };
          }

          // Mix with cliff color based on slope
          if (enableSlopeColoring && slope > slopeThreshold * 0.3) {
            const cliffBlend = Math.min(
              1,
              (slope - slopeThreshold * 0.3) / slopeThreshold
            );
            const smoothBlend = cliffBlend * cliffBlend; // Quadratic for smooth transition
            baseColor.r =
              baseColor.r * (1 - smoothBlend) + cliffRgb.r * smoothBlend;
            baseColor.g =
              baseColor.g * (1 - smoothBlend) + cliffRgb.g * smoothBlend;
            baseColor.b =
              baseColor.b * (1 - smoothBlend) + cliffRgb.b * smoothBlend;
          }

          // Add procedural color variation noise (large-scale patches)
          if (enableColorNoise && noiseGenerators) {
            const worldX = worldStartX + x * stepSize;
            const worldZ = worldStartZ + z * stepSize;

            // Use two noise layers for natural variation
            const noiseFreq = 0.01;
            const noise1 = noiseGenerators.noise(
              worldX * noiseFreq,
              worldZ * noiseFreq
            );
            const noise2 = noiseGenerators.noise2(
              worldX * noiseFreq * 2.5,
              worldZ * noiseFreq * 2.5
            );
            // Center the variation around 0 (range: -colorNoiseScale to +colorNoiseScale)
            const colorVariation =
              (noise1 * 0.6 + noise2 * 0.4) * colorNoiseScale * 2.0 -
              colorNoiseScale;

            // Apply variation (darker and lighter patches)
            // Reduce the effect to prevent over-brightening
            const variation = 1.0 + colorVariation * 0.5;
            baseColor.r *= variation;
            baseColor.g *= variation;
            baseColor.b *= variation;
          }

          // Add high-frequency texture detail noise (micro-detail)
          if (enableTextureNoise && noiseGenerators) {
            const worldX = worldStartX + x * stepSize;
            const worldZ = worldStartZ + z * stepSize;

            // High-frequency noise for texture detail
            const texFreq = textureFrequency;
            const texNoise1 = noiseGenerators.noise3(
              worldX * texFreq,
              worldZ * texFreq
            );
            const texNoise2 = noiseGenerators.noise4(
              worldX * texFreq * 2.1,
              worldZ * texFreq * 2.1
            );

            // Combine multiple octaves for realistic texture
            // Center around 0 instead of positive to avoid brightness bias
            const textureDetail =
              (texNoise1 * 0.6 + texNoise2 * 0.4) * textureNoiseScale * 2.0 -
              textureNoiseScale;

            // Apply as subtle brightness variation (simulates texture)
            // Reduced multiplier to keep it more subtle
            const texVariation = 1.0 + textureDetail * 0.3;
            baseColor.r *= texVariation;
            baseColor.g *= texVariation;
            baseColor.b *= texVariation;
          }

          r = Math.max(0, Math.min(1, baseColor.r));
          g = Math.max(0, Math.min(1, baseColor.g));
          b = Math.max(0, Math.min(1, baseColor.b));

          // Apply AO darkening
          colors.push(r * aoFactor, g * aoFactor, b * aoFactor);
        } else {
          // No gradient or slope coloring - just white with AO
          colors.push(aoFactor, aoFactor, aoFactor);
        }
      }
    }

    // Update the geometry's color attribute
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.color.needsUpdate = true;
  }, [
    geometry,
    enableHeightGradient,
    enableSlopeColoring,
    enableColorNoise,
    colorNoiseScale,
    enableTextureNoise,
    textureNoiseScale,
    textureFrequency,
    valleyColor,
    grassColor,
    mountainColor,
    peakColor,
    cliffColor,
    slopeThreshold,
    enableAO,
    aoIntensity,
    aoRadius,
    aoEdgeFade,
    segments,
    heightScale,
    chunkX,
    chunkZ,
    chunkSize,
    noiseGenerators,
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

    // Enable vertex colors if we have height gradient OR AO enabled
    const useVertexColors =
      (enableHeightGradient || enableAO) && !showColorDebug;

    return new THREE.MeshStandardMaterial({
      color: color,
      flatShading: false,
      // side: THREE.DoubleSide,
      vertexColors: useVertexColors,
      roughness: 0.95, // More rough = less shiny, more natural for terrain
      metalness: 0.0, // Terrain is not metallic
      envMapIntensity: 0.3, // Reduce environment reflection
    });
  }, [
    lodLevel,
    showColorDebug,
    segmentsPerChunk,
    enableHeightGradient,
    enableAO,
  ]);

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
export const ProceduralTerrain3 = ({
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
  onTerrainReady,
  onHeightmapReady,
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
    enableSlopeColoring,
    enableColorNoise,
    colorNoiseScale,
    enableTextureNoise,
    textureNoiseScale,
    textureFrequency,
    valleyColor,
    grassColor,
    mountainColor,
    peakColor,
    cliffColor,
    slopeThreshold,
    mountainIntensity,
    flatnessThreshold,
    flatnessSmooth,
    ridgeSharpness,
    valleyDepth,
    detailAmount,
    enableAO,
    aoIntensity,
    aoRadius,
    aoEdgeFade,
  } = useControls("🎮 Procedural Terrain 3", {
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
      label: "🎨 Enable Height Gradient",
    },
    enableSlopeColoring: {
      value: true,
      label: "🎨 Enable Slope-Based Coloring",
    },
    enableColorNoise: {
      value: true,
      label: "🎨 Enable Color Variation",
    },
    colorNoiseScale: {
      value: 0.1,
      min: 0,
      max: 0.3,
      step: 0.05,
      label: "🎨 Color Variation Amount",
    },
    enableTextureNoise: {
      value: true,
      label: "🔬 Enable Texture Detail",
    },
    textureNoiseScale: {
      value: 0.15,
      min: 0,
      max: 0.5,
      step: 0.05,
      label: "🔬 Texture Detail Amount",
    },
    textureFrequency: {
      value: 0.3,
      min: 0.05,
      max: 1.0,
      step: 0.05,
      label: "🔬 Texture Detail Frequency",
    },
    // Valley colors (low elevation, flat)
    valleyColor: {
      value: "#1a3010", // Darker green for valleys
      label: "🌿 Valley Color (Low/Flat)",
    },
    // Grassland colors (mid elevation, flat to gentle slopes)
    grassColor: {
      value: "#35591d", // More muted green
      label: "🌾 Grass Color (Mid/Gentle)",
    },
    // Mountain colors (high elevation, gentle slopes)
    mountainColor: {
      value: "#4a3f35", // Darker brown
      label: "⛰️ Mountain Color (High/Gentle)",
    },
    // Peak/Snow colors (highest elevation)
    peakColor: {
      value: "#b8b8b8", // Darker grey/snow
      label: "🏔️ Peak Color (Highest)",
    },
    // Cliff/Rock colors (steep slopes at any height)
    cliffColor: {
      value: "#3a3a3a", // Darker grey rock
      label: "🪨 Cliff Color (Steep)",
    },
    slopeThreshold: {
      value: 0.5,
      min: 0.1,
      max: 1.5,
      step: 0.05,
      label: "🪨 Slope Steepness for Cliffs",
    },
    mountainIntensity: {
      value: 3.0,
      min: 0,
      max: 3,
      step: 0.1,
      label: "🏔️ Mountain Intensity",
    },
    flatnessThreshold: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      label: "🌾 Flatness Threshold",
    },
    flatnessSmooth: {
      value: 0.2,
      min: 0,
      max: 1,
      step: 0.05,
      label: "🌾 Flatness Smoothness",
    },
    ridgeSharpness: {
      value: 2.0,
      min: 0.5,
      max: 5,
      step: 0.1,
      label: "⛰️ Ridge Sharpness",
    },
    valleyDepth: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      label: "🏞️ Valley Depth",
    },
    detailAmount: {
      value: 0.15,
      min: 0,
      max: 0.5,
      step: 0.01,
      label: "✨ Detail Amount",
    },
    enableAO: {
      value: true,
      label: "🌑 Enable Ambient Occlusion",
    },
    aoIntensity: {
      value: 0.6,
      min: 0,
      max: 2,
      step: 0.05,
      label: "🌑 AO Intensity",
    },
    aoRadius: {
      value: 5,
      min: 1,
      max: 15,
      step: 1,
      label: "🌑 AO Sample Radius",
    },
    aoEdgeFade: {
      value: 0.15,
      min: 0,
      max: 0.5,
      step: 0.05,
      label: "🌑 AO Edge Fade",
    },
  });

  const { camera } = useThree();
  const [visibleChunks, setVisibleChunks] = useState(new Map()); // Now stores chunk + LOD level
  const terrainReadyCalledRef = useRef(false);

  // Call onTerrainReady callback once when terrain chunks are actually created
  useEffect(() => {
    if (onTerrainReady && !terrainReadyCalledRef.current) {
      // For chunked mode: wait until chunks are created
      // For single terrain mode: wait a bit for geometry
      const shouldTrigger = enableChunks ? visibleChunks.size > 0 : true;

      if (shouldTrigger) {
        terrainReadyCalledRef.current = true;
        // Delay to ensure chunks are fully rendered with physics
        const timer = setTimeout(() => {
          const mode = enableChunks
            ? `${visibleChunks.size} chunks`
            : "single terrain";
          console.log(`✅ ProceduralTerrain3 ready with ${mode}`);
          onTerrainReady();
        }, 1000); // Increased delay to 1000ms for chunk geometry + physics to fully initialize
        return () => clearTimeout(timer);
      }
    }
  }, [onTerrainReady, visibleChunks.size, enableChunks]);

  // Total chunks in grid
  const chunksPerSide = Math.ceil(terrainSize / terrainChunkSize);
  const halfSize = terrainSize / 2;

  // Create noise generators ONCE - shared by all chunks
  const noiseGenerators = useMemo(() => {
    return {
      noise: createNoiseGenerator(terrainSeed),
      noise2: createNoiseGenerator(terrainSeed + 1000),
      noise3: createNoiseGenerator(terrainSeed + 2000),
      noise4: createNoiseGenerator(terrainSeed + 3000),
    };
  }, [terrainSeed]);

  // Terrain generation controls - memoized to prevent unnecessary recalculations
  const terrainControls = useMemo(
    () => ({
      mountainIntensity,
      flatnessThreshold,
      flatnessSmooth,
      ridgeSharpness,
      valleyDepth,
      detailAmount,
    }),
    [
      mountainIntensity,
      flatnessThreshold,
      flatnessSmooth,
      ridgeSharpness,
      valleyDepth,
      detailAmount,
    ]
  );

  // Expose heightmap lookup function for grass and other systems
  useEffect(() => {
    if (onHeightmapReady && noiseGenerators) {
      // Create heightmap lookup function using the shared getTerrainHeight
      const heightmapLookup = (x, z) => {
        // The terrain mesh is rotated -90° around X axis
        // After rotation: world.x = x, world.y = height, world.z = -z
        const height = getTerrainHeight(
          x,
          -z, // Invert Z due to rotation
          noiseGenerators,
          terrainHeightScale,
          terrainControls
        );
        return height;
      };

      console.log("✅ ProceduralTerrain3 heightmap ready");
      onHeightmapReady(heightmapLookup);
    }
  }, [noiseGenerators, terrainHeightScale, terrainControls, onHeightmapReady]);

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
          enableSlopeColoring={enableSlopeColoring}
          enableColorNoise={enableColorNoise}
          colorNoiseScale={colorNoiseScale}
          enableTextureNoise={enableTextureNoise}
          textureNoiseScale={textureNoiseScale}
          textureFrequency={textureFrequency}
          valleyColor={valleyColor}
          grassColor={grassColor}
          mountainColor={mountainColor}
          peakColor={peakColor}
          cliffColor={cliffColor}
          slopeThreshold={slopeThreshold}
          terrainControls={terrainControls}
          enableAO={enableAO}
          aoIntensity={aoIntensity}
          aoRadius={aoRadius}
          aoEdgeFade={aoEdgeFade}
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
            enableSlopeColoring={enableSlopeColoring}
            enableColorNoise={enableColorNoise}
            colorNoiseScale={colorNoiseScale}
            valleyColor={valleyColor}
            grassColor={grassColor}
            mountainColor={mountainColor}
            peakColor={peakColor}
            cliffColor={cliffColor}
            slopeThreshold={slopeThreshold}
            terrainControls={terrainControls}
            enableAO={enableAO}
            aoIntensity={aoIntensity}
            aoRadius={aoRadius}
            aoEdgeFade={aoEdgeFade}
          />
        );
      })}
    </group>
  );
};
