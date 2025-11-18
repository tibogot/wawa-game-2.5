import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import { useControls } from "leva";

// Simple Perlin-like noise implementation (copied from your working ProceduralTerrain)
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

// Enhanced terrain height calculation (based on your working ProceduralTerrain)
function getEnhancedTerrainHeight(
  worldX,
  worldZ,
  noiseGenerators,
  mountainScale,
  riverScale,
  flatScale
) {
  const { noise, noise2, noise3 } = noiseGenerators;

  // BASE TERRAIN (smooth, gentle variations)
  const baseFreq = 0.0008; // Lower frequency for smoother base
  const base1 = noise(worldX * baseFreq, worldZ * baseFreq);
  const base2 = noise2(worldX * baseFreq * 0.5, worldZ * baseFreq * 0.5);
  const baseTerrain = (base1 * 0.7 + base2 * 0.3) * 0.8; // Gentler base

  // MOUNTAIN RANGES (large, smooth mountains)
  const mountainFreq = 0.0005; // Much lower frequency for large mountains
  const mountains = noise3(worldX * mountainFreq, worldZ * mountainFreq);
  const mountainMask = Math.max(0, mountains * mountains * 0.8); // Smoother mountains

  // MAIN RIVER (one flowing river)
  const riverFreq = 0.0003; // Very low frequency for one main river
  const riverX = worldX * riverFreq;
  const riverZ = worldZ * riverFreq;
  const river = noise(riverX, riverZ + 100); // Offset for river path
  const riverMask = Math.max(0, -river * river * 0.6); // One main river valley

  // ROLLING HILLS (gentle hills)
  const hillFreq = 0.002; // Lower frequency for smoother hills
  const hills = noise(worldX * hillFreq + 100, worldZ * hillFreq + 100) * 0.3;

  // FINE DETAIL (subtle texture)
  const detailFreq = 0.008; // Lower frequency for subtle detail
  const detail =
    noise2(worldX * detailFreq + 50, worldZ * detailFreq + 50) * 0.15;

  // Combine with selective scaling
  let height = baseTerrain + hills + detail;

  // Add mountains with mountain scale
  height += mountainMask * mountainScale;

  // Add rivers with river scale (negative)
  height -= riverMask * Math.abs(riverScale);

  // Apply flat area scaling
  height *= flatScale;

  // Power curve
  const sign = height >= 0 ? 1 : -1;
  height = sign * Math.pow(Math.abs(height), 1.4);

  // Safety check
  if (!isFinite(height) || Math.abs(height) > 10000) {
    return 0;
  }

  return height;
}

export const EnhancedProceduralTerrain = ({
  size = 2000,
  segments = 200,
  position = [0, 0, 0],
  scale = 1,
  ...props
}) => {
  const group = useRef();

  const { seed, mountainScale, riverScale, flatScale, showWireframe } =
    useControls("🏔️ Enhanced Terrain", {
      seed: {
        value: 12345,
        min: 0,
        max: 99999,
        step: 1,
        label: "🌱 Seed",
      },
      mountainScale: {
        value: 50,
        min: 0,
        max: 150,
        step: 5,
        label: "⛰️ Mountain Height",
      },
      riverScale: {
        value: -20,
        min: -80,
        max: 0,
        step: 5,
        label: "🌊 River Depth",
      },
      flatScale: {
        value: 15,
        min: 5,
        max: 30,
        step: 2,
        label: "🏞️ Flat Area Height",
      },
      showWireframe: {
        value: false,
        label: "🔍 Show Wireframe",
      },
    });

  // Create noise generators (same as your working ProceduralTerrain)
  const noiseGenerators = useMemo(
    () => ({
      noise: createNoiseGenerator(seed),
      noise2: createNoiseGenerator(seed + 1000),
      noise3: createNoiseGenerator(seed + 2000),
    }),
    [seed]
  );

  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    const positions = geometry.attributes.position.array;

    console.log(
      `🏔️ Generating enhanced terrain: Mountain=${mountainScale}, River=${riverScale}, Flat=${flatScale}`
    );

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 1];

      // Get height using your working method
      const height = getEnhancedTerrainHeight(
        x,
        z,
        noiseGenerators,
        mountainScale,
        riverScale,
        flatScale
      );

      positions[i + 2] = height;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    console.log(
      `🏔️ Enhanced terrain generated with ${positions.length / 3} vertices`
    );
    return geometry;
  }, [
    size,
    segments,
    seed,
    mountainScale,
    riverScale,
    flatScale,
    noiseGenerators,
  ]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: "#8B4513", // Brown terrain color
      wireframe: showWireframe,
      metalness: 0.1,
      roughness: 0.8,
    });
  }, [showWireframe]);

  return (
    <group ref={group} {...props}>
      <RigidBody type="fixed" colliders="trimesh">
        <mesh
          position={position}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={scale}
          geometry={geometry}
          material={material}
          receiveShadow
          castShadow
        />
      </RigidBody>
    </group>
  );
};

export default EnhancedProceduralTerrain;
