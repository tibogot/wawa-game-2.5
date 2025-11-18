import { useRef, useMemo, useEffect } from "react";
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

// Height calculation
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

  // Safety check
  if (!isFinite(finalHeight) || Math.abs(finalHeight) > 10000) {
    return 0;
  }

  return finalHeight;
}

// Simplified terrain component - single mesh, no chunks, no LOD
export const ProceduralTerrain2 = ({
  size = 2000,
  segments = 512,
  heightScale = 75,
  seed = 18871,
  onHeightmapReady,
}) => {
  const meshRef = useRef();

  const {
    terrainSize,
    terrainSegments,
    terrainHeightScale,
    terrainSeed,
    enableHeightGradient,
    lowColor,
    midColor,
    highColor,
    lowHeight,
    highHeight,
  } = useControls("🌄 Simple Terrain", {
    terrainSize: {
      value: size,
      min: 500,
      max: 5000,
      step: 100,
      label: "Terrain Size",
    },
    terrainSegments: {
      value: segments,
      min: 20,
      max: 1024,
      step: 10,
      label: "Detail Level",
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
    enableHeightGradient: {
      value: true,
      label: "Enable Height Colors",
    },
    lowColor: {
      value: "#2d5016",
      label: "Low Height Color",
    },
    midColor: {
      value: "#8b4513",
      label: "Mid Height Color",
    },
    highColor: {
      value: "#ffffff",
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

  // Create noise generators
  const noiseGenerators = useMemo(() => {
    return {
      noise: createNoiseGenerator(terrainSeed),
      noise2: createNoiseGenerator(terrainSeed + 1000),
      noise3: createNoiseGenerator(terrainSeed + 2000),
    };
  }, [terrainSeed]);

  const geometry = useMemo(() => {
    const verticesPerSide = terrainSegments + 1;
    const positions = [];
    const indices = [];
    const uvs = [];
    const colors = [];

    const halfSize = terrainSize / 2;
    const stepSize = terrainSize / terrainSegments;

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

    const lowRgb = hexToRgb(lowColor);
    const midRgb = hexToRgb(midColor);
    const highRgb = hexToRgb(highColor);

    // Generate vertices
    for (let z = 0; z <= terrainSegments; z++) {
      for (let x = 0; x <= terrainSegments; x++) {
        const worldX = x * stepSize - halfSize;
        const worldZ = z * stepSize - halfSize;

        const height = getTerrainHeight(
          worldX,
          worldZ,
          noiseGenerators,
          terrainHeightScale
        );

        positions.push(worldX, worldZ, height);
        uvs.push(x / terrainSegments, z / terrainSegments);

        // Calculate vertex color based on height
        if (enableHeightGradient) {
          const normalizedHeight = Math.max(
            0,
            Math.min(1, (height - lowHeight) / (highHeight - lowHeight))
          );

          let r, g, b;

          if (normalizedHeight < 0.5) {
            const t = normalizedHeight * 2;
            r = lowRgb.r + (midRgb.r - lowRgb.r) * t;
            g = lowRgb.g + (midRgb.g - lowRgb.g) * t;
            b = lowRgb.b + (midRgb.b - lowRgb.b) * t;
          } else {
            const t = (normalizedHeight - 0.5) * 2;
            r = midRgb.r + (highRgb.r - midRgb.r) * t;
            g = midRgb.g + (highRgb.g - midRgb.g) * t;
            b = midRgb.b + (highRgb.b - midRgb.b) * t;
          }

          colors.push(r, g, b);
        } else {
          colors.push(1, 1, 1);
        }
      }
    }

    // Generate indices
    for (let z = 0; z < terrainSegments; z++) {
      for (let x = 0; x < terrainSegments; x++) {
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
    terrainSize,
    terrainSegments,
    terrainHeightScale,
    noiseGenerators,
    enableHeightGradient,
    lowColor,
    midColor,
    highColor,
    lowHeight,
    highHeight,
  ]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: false,
      //   side: THREE.DoubleSide,
      vertexColors: enableHeightGradient,
    });
  }, [enableHeightGradient]);

  // Expose heightmap lookup function for grass and other systems
  useEffect(() => {
    if (onHeightmapReady && geometry) {
      // Create heightmap lookup function
      const heightmapLookup = (x, z) => {
        // The terrain mesh is rotated -90° around X axis (rotation={[-Math.PI / 2, 0, 0]})
        // Original geometry: positions.push(worldX, worldZ, height)
        // After rotation: world.x = worldX, world.y = height, world.z = -worldZ
        // So we need to negate the Z coordinate when looking up height
        const height = getTerrainHeight(
          x,
          -z,
          noiseGenerators,
          terrainHeightScale
        );
        return height;
      };

      console.log("✅ ProceduralTerrain2 heightmap ready");
      onHeightmapReady(heightmapLookup);
    }
  }, [geometry, onHeightmapReady, noiseGenerators, terrainHeightScale]);

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
};
