import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import { useControls } from "leva";
import { createNoise2D } from "simplex-noise";
import alea from "alea";
import { TextureLoader } from "three";

// Simplex noise generator using simplex-noise library
function createNoiseGenerator(seed = 0) {
  const prng = alea(seed);
  const noise2D = createNoise2D(prng);

  // Return wrapper function that matches the interface from ProceduralTerrain3
  return (x, y) => noise2D(x, y);
}

// Fractional Brownian Motion (fBm) - Multiple octaves of noise for natural terrain
// Creates fractal-like detail by layering noise at different frequencies and amplitudes
function fBm(
  noiseFunc,
  x,
  y,
  octaves = 6,
  frequency = 0.0005,
  persistence = 0.5,
  lacunarity = 2.0,
  amplitude = 1.0,
  offsetX = 0,
  offsetY = 0
) {
  let value = 0;
  let amp = amplitude;
  let freq = frequency;
  let maxValue = 0; // For normalization

  // Add multiple octaves (layers) of noise
  for (let i = 0; i < octaves; i++) {
    value += noiseFunc(x * freq + offsetX, y * freq + offsetY) * amp;
    maxValue += amp;

    // Each octave: frequency doubles, amplitude reduces by persistence
    freq *= lacunarity;
    amp *= persistence;
  }

  // Normalize to keep values in a reasonable range
  return maxValue > 0 ? value / maxValue : 0;
}

// SHARED height calculation - Optimized for BOTW-style open world
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
    flatnessThreshold = 0.35,
    flatnessSmooth = 0.25,
    ridgeSharpness = 1.8,
    valleyDepth = 0.4,
    detailAmount = 0.18,
    biomeVariation = 0.5,
    // fBm controls
    fbmEnabled = true,
    fbmOctaves = 6,
    fbmPersistence = 0.5,
    fbmLacunarity = 2.0,
    fbmBaseFrequency = 0.0005,
  } = terrainControls;

  // === LARGE-SCALE REGIONS - Creates distinct biomes/areas ===
  const regionFreq = 0.0006; // Lower frequency for larger regions
  const regionNoise = noise(worldX * regionFreq, worldZ * regionFreq);
  const regionNoise2 = noise2(
    worldX * regionFreq * 1.5 + 1000,
    worldZ * regionFreq * 1.5 + 1000
  );
  const regionMask = (regionNoise * 0.65 + regionNoise2 * 0.35) * 0.5 + 0.5; // 0 to 1

  // === FLAT PLAINS - Large traversable areas like Hyrule Field ===
  let flatnessFactor = 1.0;
  if (regionMask < flatnessThreshold) {
    // Smooth transition to flat - creates wide plains
    flatnessFactor =
      Math.pow(regionMask / flatnessThreshold, 1.8) * flatnessSmooth +
      (1 - flatnessSmooth);
  }

  // === RIDGED MOUNTAINS - Smooth peaks and ridges with fBm ===
  let ridgeTerrain;
  if (fbmEnabled) {
    // Use fBm for more natural ridge patterns
    const ridgeFreq = 0.0012;
    const ridgeFbm1 = fBm(
      noise3,
      worldX,
      worldZ,
      Math.floor(fbmOctaves * 0.7),
      ridgeFreq,
      fbmPersistence * 0.8, // Slightly lower persistence for smoother ridges
      fbmLacunarity,
      1.0,
      0,
      0
    );
    let ridge1 = Math.abs(ridgeFbm1);
    ridge1 = 1 - ridge1; // Invert to create ridges

    const ridgeFbm2 = fBm(
      noise4,
      worldX,
      worldZ,
      Math.floor(fbmOctaves * 0.6),
      ridgeFreq * 2.3,
      fbmPersistence * 0.7,
      fbmLacunarity,
      1.0,
      2000,
      2000
    );
    let ridge2 = Math.abs(ridgeFbm2);
    ridge2 = 1 - ridge2;

    // Smooth ridges
    ridge1 = Math.pow(ridge1, Math.max(1.0, ridgeSharpness * 0.6));
    ridge1 = Math.pow(ridge1, 0.85);
    ridge2 = Math.pow(ridge2, Math.max(1.0, ridgeSharpness * 0.55));
    ridge2 = Math.pow(ridge2, 0.85);

    const ridgeBlend = ridge1 * 0.75 + ridge2 * 0.25;
    ridgeTerrain = Math.pow(ridgeBlend, 0.95) * mountainIntensity;
  } else {
    // Fallback to original
    const ridgeFreq = 0.0012;
    let ridge1 = Math.abs(noise3(worldX * ridgeFreq, worldZ * ridgeFreq));
    ridge1 = 1 - ridge1;
    ridge1 = Math.pow(ridge1, Math.max(1.0, ridgeSharpness * 0.6));
    ridge1 = Math.pow(ridge1, 0.85);

    let ridge2 = Math.abs(
      noise4(worldX * ridgeFreq * 2.3 + 2000, worldZ * ridgeFreq * 2.3 + 2000)
    );
    ridge2 = 1 - ridge2;
    ridge2 = Math.pow(ridge2, Math.max(1.0, ridgeSharpness * 0.55));
    ridge2 = Math.pow(ridge2, 0.85);

    const ridgeBlend = ridge1 * 0.75 + ridge2 * 0.25;
    ridgeTerrain = Math.pow(ridgeBlend, 0.95) * mountainIntensity;
  }

  // === BASE TERRAIN - Gentle undulating landscape ===
  // Use fBm for more natural, fractal-like terrain
  let baseTerrain;
  if (fbmEnabled) {
    // fBm creates natural multi-scale detail
    const fbm1 = fBm(
      noise,
      worldX,
      worldZ,
      fbmOctaves,
      fbmBaseFrequency,
      fbmPersistence,
      fbmLacunarity,
      1.0,
      3000,
      3000
    );
    const fbm2 = fBm(
      noise2,
      worldX,
      worldZ,
      Math.floor(fbmOctaves * 0.8),
      fbmBaseFrequency * 0.6,
      fbmPersistence,
      fbmLacunarity,
      1.0,
      4000,
      4000
    );
    baseTerrain = (fbm1 * 0.65 + fbm2 * 0.35) * 0.6;
  } else {
    // Fallback to original single-octave approach
    const baseFreq = 0.0005;
    const base1 = noise(worldX * baseFreq + 3000, worldZ * baseFreq + 3000);
    const base2 = noise2(
      worldX * baseFreq * 0.6 + 4000,
      worldZ * baseFreq * 0.6 + 4000
    );
    baseTerrain = (base1 * 0.65 + base2 * 0.35) * 0.6;
  }

  // === VALLEYS AND DEPRESSIONS - Negative features ===
  const valleyFreq = 0.0009;
  const valleyNoise = noise3(
    worldX * valleyFreq + 5000,
    worldZ * valleyFreq + 5000
  );
  const valleys = Math.min(0, valleyNoise * valleyDepth);

  // === ROLLING HILLS - Medium frequency undulation with fBm ===
  const hillFreq = 0.002;
  let hills;
  if (fbmEnabled) {
    hills =
      fBm(
        noise4,
        worldX,
        worldZ,
        Math.floor(fbmOctaves * 0.5),
        hillFreq,
        fbmPersistence * 0.9,
        fbmLacunarity,
        1.0,
        6000,
        6000
      ) * 0.25;
  } else {
    hills = noise4(worldX * hillFreq + 6000, worldZ * hillFreq + 6000) * 0.25;
  }

  // === FINE DETAIL - Surface texture with fBm ===
  const detailFreq = 0.007;
  let detail;
  if (fbmEnabled) {
    detail =
      fBm(
        noise2,
        worldX,
        worldZ,
        Math.floor(fbmOctaves * 0.4),
        detailFreq,
        fbmPersistence * 0.6,
        fbmLacunarity,
        1.0,
        7000,
        7000
      ) *
      detailAmount *
      0.6; // Reduced to prevent spike artifacts
  } else {
    detail =
      noise2(worldX * detailFreq + 7000, worldZ * detailFreq + 7000) *
      detailAmount *
      0.6;
  }

  // === COMBINE LAYERS ===
  // Mountain regions get ridges, flat regions stay mostly flat
  const mountainMask = Math.pow(
    Math.max(0, regionMask - flatnessThreshold),
    1.3
  );
  const mountainHeight = ridgeTerrain * mountainMask;

  // Add biome variation for more interesting terrain
  const biomeVar =
    noise4(worldX * 0.0004 + 8000, worldZ * 0.0004 + 8000) *
    biomeVariation *
    0.3;

  let height =
    baseTerrain +
    mountainHeight +
    valleys +
    hills +
    detail * flatnessFactor +
    biomeVar;

  // Apply flatness factor to reduce all variation in flat areas
  height = height * flatnessFactor;

  // Smooth the final height to remove any remaining spikes
  // This acts as a gentle low-pass filter on the noise output
  // We can't sample neighbors here, but we can apply a smoothing function
  // by slightly reducing extreme values
  const heightNormalized = height;
  const smoothedHeight =
    heightNormalized * 0.98 +
    Math.sign(heightNormalized) * Math.abs(heightNormalized) * 0.02 * 0.5;

  const finalHeight = smoothedHeight * heightScale;

  // Safety check - clamp height to prevent rendering issues
  if (!isFinite(finalHeight) || Math.abs(finalHeight) > 10000) {
    return 0;
  }

  return finalHeight;
}

// Single terrain chunk with SHADER-BASED coloring
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
  enableColorNoise,
  colorNoiseScale,
  enableTextureNoise,
  textureNoiseScale,
  textureFrequency,
  valleyColor,
  grassColor,
  mountainColor,
  peakColor,
  heightValley,
  heightGrass,
  heightSlope,
  heightPeak,
  terrainControls,
  groundTexture,
  normalMapTexture,
  roughnessMapTexture,
  textureRepeat,
  useTexture,
}) {
  const meshRef = useRef();
  const heightMapRef = useRef(null);

  // Step 1: Generate base geometry (positions, indices, uvs) - NO vertex colors
  const geometry = useMemo(() => {
    const verticesPerSide = segments + 1;
    const positions = [];
    const indices = [];
    const uvs = [];

    const worldStartX = chunkX * chunkSize;
    const worldStartZ = chunkZ * chunkSize;
    const stepSize = chunkSize / segments;

    // Generate heightmap and store in ref for later use (for heightmap lookup)
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

    heightMapRef.current = heightMap;

    // Generate positions and UVs (NO vertex colors - colors come from shader)
    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const height = heightMap[z][x];
        const worldX = worldStartX + x * stepSize;
        const worldZ = worldStartZ + z * stepSize;
        positions.push(worldX, worldZ, height);
        uvs.push(x / segments, z / segments);
      }
    }

    // Generate indices for triangles
    for (let z = 0; z < segments; z++) {
      for (let x = 0; x < segments; x++) {
        const a = x + z * verticesPerSide;
        const b = x + (z + 1) * verticesPerSide;
        const c = x + 1 + (z + 1) * verticesPerSide;
        const d = x + 1 + z * verticesPerSide;

        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    // NO color attribute - colors come from shader
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
  ]);

  // Step 2: Create material with onBeforeCompile for SHADER-BASED height coloring
  const material = useMemo(() => {
    let color = 0xffffff;
    if (showColorDebug) {
      const highThreshold = Math.floor(segmentsPerChunk * 0.8);
      const mediumThreshold = Math.floor(segmentsPerChunk * 0.4);
      if (lodLevel >= highThreshold) {
        color = 0x00ff00;
      } else if (lodLevel >= mediumThreshold) {
        color = 0xffff00;
      } else {
        color = 0xff0000;
      }
    }

    const material = new THREE.MeshStandardMaterial({
      color: color,
      flatShading: false,
      roughness: 1.0, // Lower = shinier, higher = rougher (0.0 to 1.0)
      metalness: 0.0,
      envMapIntensity: 0.3,
    });

    // Apply ground texture if provided and enabled
    if (useTexture && groundTexture) {
      // Clone the texture to avoid conflicts across chunks
      const texture = groundTexture.clone();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(textureRepeat, textureRepeat);
      texture.anisotropy = 16;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      material.map = texture;
    }

    // Apply normal map if provided and enabled
    if (useTexture && normalMapTexture) {
      const normalMap = normalMapTexture.clone();
      normalMap.wrapS = THREE.RepeatWrapping;
      normalMap.wrapT = THREE.RepeatWrapping;
      normalMap.repeat.set(textureRepeat, textureRepeat);
      normalMap.anisotropy = 16;
      normalMap.minFilter = THREE.LinearMipmapLinearFilter;
      normalMap.magFilter = THREE.LinearFilter;
      material.normalMap = normalMap;
      // Normal scale - 1.0 is standard, adjust as needed (0.5-2.0 range is typical)
      material.normalScale = new THREE.Vector2(0.1, 0.1);
      // Set normal map type - "NormalGL" suggests OpenGL format
      material.normalMapType = THREE.TangentSpaceNormalMap;
    } else {
      // Debug log if not applied
      if (useTexture) {
        console.warn(
          "⚠️ Normal map not applied - texture missing or useTexture disabled"
        );
      }
    }

    // Apply roughness map if provided and enabled
    if (useTexture && roughnessMapTexture) {
      const roughnessMap = roughnessMapTexture.clone();
      roughnessMap.wrapS = THREE.RepeatWrapping;
      roughnessMap.wrapT = THREE.RepeatWrapping;
      roughnessMap.repeat.set(textureRepeat, textureRepeat);
      roughnessMap.anisotropy = 16;
      roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
      roughnessMap.magFilter = THREE.LinearFilter;
      material.roughnessMap = roughnessMap;
      // When using roughness map, set base roughness (lower = shinier, higher = rougher)
      material.roughness = 10; // Changed from 1.0 - adjust this value as needed
    } else {
      // Debug log if not applied
      if (useTexture) {
        console.warn(
          "⚠️ Roughness map not applied - texture missing or useTexture disabled"
        );
      }
    }

    // Only apply shader-based coloring if height gradient is enabled
    if (enableHeightGradient && !showColorDebug) {
      material.onBeforeCompile = (shader) => {
        // Add custom uniforms for height-based coloring
        shader.uniforms.colorValley = { value: new THREE.Color(valleyColor) };
        shader.uniforms.colorGrass = { value: new THREE.Color(grassColor) };
        shader.uniforms.colorMountain = {
          value: new THREE.Color(mountainColor),
        };
        shader.uniforms.colorPeak = { value: new THREE.Color(peakColor) };
        shader.uniforms.heightValley = { value: heightValley };
        shader.uniforms.heightGrass = { value: heightGrass };
        shader.uniforms.heightSlope = { value: heightSlope };
        shader.uniforms.heightPeak = { value: heightPeak };
        // Noise uniforms
        shader.uniforms.enableColorNoise = {
          value: enableColorNoise ? 1.0 : 0.0,
        };
        shader.uniforms.colorNoiseScale = { value: colorNoiseScale };
        shader.uniforms.enableTextureNoise = {
          value: enableTextureNoise ? 1.0 : 0.0,
        };
        shader.uniforms.textureNoiseScale = { value: textureNoiseScale };
        shader.uniforms.textureFrequency = { value: textureFrequency };
        // Texture blending uniform
        shader.uniforms.useTextureMap = {
          value: useTexture && groundTexture ? 1.0 : 0.0,
        };

        // Modify vertex shader to pass world position
        shader.vertexShader = shader.vertexShader.replace(
          "#include <common>",
          `
          #include <common>
          varying vec3 vWorldPos;
          `
        );

        shader.vertexShader = shader.vertexShader.replace(
          "#include <worldpos_vertex>",
          `
          #include <worldpos_vertex>
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          `
        );

        // Modify fragment shader to add height-based coloring with noise
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <common>",
          `
          #include <common>
          varying vec3 vWorldPos;
          uniform vec3 colorValley;
          uniform vec3 colorGrass;
          uniform vec3 colorMountain;
          uniform vec3 colorPeak;
          uniform float heightValley;
          uniform float heightGrass;
          uniform float heightSlope;
          uniform float heightPeak;
          uniform float enableColorNoise;
          uniform float colorNoiseScale;
          uniform float enableTextureNoise;
          uniform float textureNoiseScale;
          uniform float textureFrequency;
          uniform float useTextureMap;
          
          // Simple hash-based noise function for GPU (similar to Simplex noise)
          float hash(vec2 p) {
            p = mod(p, 256.0);
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }
          
          vec3 getHeightColor(float height) {
            vec3 color;
            if (height < heightGrass) {
              float t = smoothstep(heightValley, heightGrass, height);
              color = mix(colorValley, colorGrass, t);
            }
            else if (height < heightSlope) {
              float t = smoothstep(heightGrass, heightSlope, height);
              color = mix(colorGrass, colorMountain, t);
            }
            else {
              float t = smoothstep(heightSlope, heightPeak, height);
              color = mix(colorMountain, colorPeak, t);
            }
            return color;
          }
          `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          `
          #include <color_fragment>
          vec3 heightColor = getHeightColor(vWorldPos.y);
          
          // Apply color noise variation
          if (enableColorNoise > 0.5) {
            float noiseFreq = 0.008;
            vec2 noisePos = vWorldPos.xz * noiseFreq;
            float n1 = noise(noisePos);
            float n2 = noise(noisePos * 2.7);
            float colorVariation = (n1 * 0.65 + n2 * 0.35) * colorNoiseScale * 2.0 - colorNoiseScale;
            float variation = 1.0 + colorVariation * 0.5;
            heightColor *= variation;
          }
          
          // Apply texture detail noise
          if (enableTextureNoise > 0.5) {
            vec2 texPos = vWorldPos.xz * textureFrequency;
            float n1 = noise(texPos);
            float n2 = noise(texPos * 2.2);
            float textureDetail = (n1 * 0.65 + n2 * 0.35) * textureNoiseScale * 2.0 - textureNoiseScale;
            float texVariation = 1.0 + textureDetail * 0.3;
            heightColor *= texVariation;
          }
          
          // Blend texture with height colors if texture is enabled
          #ifdef USE_MAP
            if (useTextureMap > 0.5) {
              // Multiply texture (already applied to diffuseColor) with height color
              diffuseColor.rgb = heightColor * diffuseColor.rgb;
            } else {
              // Use texture as-is without height blending
            }
          #else
            // No texture, use height colors directly
            diffuseColor.rgb = heightColor;
          #endif
          `
        );

        material.userData.shader = shader;
      };
    }

    return material;
  }, [
    lodLevel,
    showColorDebug,
    segmentsPerChunk,
    enableHeightGradient,
    enableColorNoise,
    colorNoiseScale,
    enableTextureNoise,
    textureNoiseScale,
    textureFrequency,
    valleyColor,
    grassColor,
    mountainColor,
    peakColor,
    heightValley,
    heightGrass,
    heightSlope,
    heightPeak,
    groundTexture,
    normalMapTexture,
    roughnessMapTexture,
    textureRepeat,
    useTexture,
  ]);

  // Update texture settings when they change
  useEffect(() => {
    if (groundTexture) {
      groundTexture.needsUpdate = true;
    }
  }, [groundTexture, textureRepeat, useTexture]);

  // Update shader uniforms when noise settings change
  useEffect(() => {
    if (material && material.userData && material.userData.shader) {
      const shader = material.userData.shader;
      if (shader.uniforms) {
        if (shader.uniforms.enableColorNoise !== undefined) {
          shader.uniforms.enableColorNoise.value = enableColorNoise ? 1.0 : 0.0;
        }
        if (shader.uniforms.colorNoiseScale) {
          shader.uniforms.colorNoiseScale.value = colorNoiseScale;
        }
        if (shader.uniforms.enableTextureNoise !== undefined) {
          shader.uniforms.enableTextureNoise.value = enableTextureNoise
            ? 1.0
            : 0.0;
        }
        if (shader.uniforms.textureNoiseScale) {
          shader.uniforms.textureNoiseScale.value = textureNoiseScale;
        }
        if (shader.uniforms.textureFrequency) {
          shader.uniforms.textureFrequency.value = textureFrequency;
        }
        if (shader.uniforms.useTextureMap !== undefined) {
          shader.uniforms.useTextureMap.value =
            useTexture && groundTexture ? 1.0 : 0.0;
        }
        // Also update color uniforms if they change
        if (shader.uniforms.colorValley) {
          shader.uniforms.colorValley.value.set(valleyColor);
        }
        if (shader.uniforms.colorGrass) {
          shader.uniforms.colorGrass.value.set(grassColor);
        }
        if (shader.uniforms.colorMountain) {
          shader.uniforms.colorMountain.value.set(mountainColor);
        }
        if (shader.uniforms.colorPeak) {
          shader.uniforms.colorPeak.value.set(peakColor);
        }
        if (shader.uniforms.heightValley) {
          shader.uniforms.heightValley.value = heightValley;
        }
        if (shader.uniforms.heightGrass) {
          shader.uniforms.heightGrass.value = heightGrass;
        }
        if (shader.uniforms.heightSlope) {
          shader.uniforms.heightSlope.value = heightSlope;
        }
        if (shader.uniforms.heightPeak) {
          shader.uniforms.heightPeak.value = heightPeak;
        }
      }
    }
  }, [
    material,
    enableColorNoise,
    colorNoiseScale,
    enableTextureNoise,
    textureNoiseScale,
    textureFrequency,
    valleyColor,
    grassColor,
    mountainColor,
    peakColor,
    heightValley,
    heightGrass,
    heightSlope,
    heightPeak,
    useTexture,
    groundTexture,
  ]);

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

// Main terrain system - Optimized for BOTW-style open world with SHADER-BASED coloring
export const ProceduralTerrain8 = ({
  size = 2500,
  chunkSize = 500,
  segments = 512,
  heightScale = 85,
  seed = 24601,
  viewDistance = 1200,
  lodNear = 400,
  lodMedium = 800,
  lodFar = 1200,
  onTerrainReady,
  onHeightmapReady,
}) => {
  // Load all terrain textures
  const groundTexture = useLoader(
    TextureLoader,
    "/textures/Grass005_1K-JPG_Color.jpg"
  );
  const normalMapTexture = useLoader(
    TextureLoader,
    "/textures/Ground036_1K-JPG_NormalGL.jpg"
  );
  const roughnessMapTexture = useLoader(
    TextureLoader,
    "/textures/Ground036_1K-JPG_Roughness.jpg"
  );

  // Initialize texture settings once and verify loading
  useEffect(() => {
    if (groundTexture) {
      console.log("✅ Color texture loaded:", groundTexture.image?.src);
      groundTexture.wrapS = THREE.RepeatWrapping;
      groundTexture.wrapT = THREE.RepeatWrapping;
      groundTexture.minFilter = THREE.LinearMipmapLinearFilter;
      groundTexture.magFilter = THREE.LinearFilter;
      groundTexture.generateMipmaps = true;
      groundTexture.anisotropy = 16;
    } else {
      console.warn("⚠️ Color texture not loaded!");
    }
    if (normalMapTexture) {
      console.log("✅ Normal map texture loaded:", normalMapTexture.image?.src);
      normalMapTexture.wrapS = THREE.RepeatWrapping;
      normalMapTexture.wrapT = THREE.RepeatWrapping;
      normalMapTexture.minFilter = THREE.LinearMipmapLinearFilter;
      normalMapTexture.magFilter = THREE.LinearFilter;
      normalMapTexture.generateMipmaps = true;
      normalMapTexture.anisotropy = 16;
    } else {
      console.warn("⚠️ Normal map texture not loaded!");
    }
    if (roughnessMapTexture) {
      console.log(
        "✅ Roughness map texture loaded:",
        roughnessMapTexture.image?.src
      );
      roughnessMapTexture.wrapS = THREE.RepeatWrapping;
      roughnessMapTexture.wrapT = THREE.RepeatWrapping;
      roughnessMapTexture.minFilter = THREE.LinearMipmapLinearFilter;
      roughnessMapTexture.magFilter = THREE.LinearFilter;
      roughnessMapTexture.generateMipmaps = true;
      roughnessMapTexture.anisotropy = 16;
    } else {
      console.warn("⚠️ Roughness map texture not loaded!");
    }
  }, [groundTexture, normalMapTexture, roughnessMapTexture]);

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
    enableColorNoise,
    colorNoiseScale,
    enableTextureNoise,
    textureNoiseScale,
    textureFrequency,
    valleyColor,
    grassColor,
    mountainColor,
    peakColor,
    heightValley,
    heightGrass,
    heightSlope,
    heightPeak,
    mountainIntensity,
    flatnessThreshold,
    flatnessSmooth,
    ridgeSharpness,
    valleyDepth,
    detailAmount,
    useTexture,
    textureRepeat,
    fbmEnabled,
    fbmOctaves,
    fbmPersistence,
    fbmLacunarity,
    fbmBaseFrequency,
  } = useControls("🗻 BOTW Terrain v6 (Texture)", {
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
      label: "🎨 Enable Height Gradient (Shader)",
    },
    enableColorNoise: {
      value: true,
      label: "🎨 Enable Color Variation (Noise)",
    },
    colorNoiseScale: {
      value: 0.12,
      min: 0,
      max: 0.3,
      step: 0.05,
      label: "🎨 Color Variation Amount",
    },
    enableTextureNoise: {
      value: true,
      label: "🔬 Enable Texture Detail (Noise)",
    },
    textureNoiseScale: {
      value: 0.18,
      min: 0,
      max: 0.5,
      step: 0.05,
      label: "🔬 Texture Detail Amount",
    },
    textureFrequency: {
      value: 0.35,
      min: 0.05,
      max: 1.0,
      step: 0.05,
      label: "🔬 Texture Detail Frequency",
    },
    // BOTW-inspired color palette
    valleyColor: {
      value: "#133808", // Darker green for valleys
      label: "🌿 Valley Color (Low/Flat)",
    },
    grassColor: {
      value: "#1d4110", // Vibrant green for plains
      label: "🌾 Grass Color (Mid/Gentle)",
    },
    mountainColor: {
      value: "#2d5016", // Brown-gray for mountains
      label: "⛰️ Mountain Color (High)",
    },
    peakColor: {
      value: "#d4d4d4", // Light gray for peaks/snow
      label: "🏔️ Peak Color (Highest/Snow)",
    },
    heightValley: {
      value: -heightScale * 0.3,
      min: -100,
      max: 0,
      step: 1,
      label: "Valley Height (start gradient)",
    },
    heightGrass: {
      value: 0,
      min: -50,
      max: 50,
      step: 1,
      label: "Grass Height",
    },
    heightSlope: {
      value: heightScale * 0.4,
      min: 0,
      max: 200,
      step: 1,
      label: "Slope/Mountain Height",
    },
    heightPeak: {
      value: heightScale * 0.8,
      min: 140,
      max: 300,
      step: 1,
      label: "Peak Height (snow line)",
    },
    mountainIntensity: {
      value: 3.5,
      min: 0,
      max: 5,
      step: 0.1,
      label: "🏔️ Mountain Intensity",
    },
    flatnessThreshold: {
      value: 0.35,
      min: 0,
      max: 1,
      step: 0.05,
      label: "🌾 Flatness Threshold",
    },
    flatnessSmooth: {
      value: 0.25,
      min: 0,
      max: 1,
      step: 0.05,
      label: "🌾 Flatness Smoothness",
    },
    ridgeSharpness: {
      value: 1.8,
      min: 0.5,
      max: 5,
      step: 0.1,
      label: "⛰️ Ridge Sharpness (softer to prevent spikes)",
    },
    valleyDepth: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.05,
      label: "🏞️ Valley Depth",
    },
    detailAmount: {
      value: 0.04,
      min: 0,
      max: 0.5,
      step: 0.01,
      label: "✨ Detail Amount (reduced to prevent spikes)",
    },
    useTexture: {
      value: true,
      label: "🖼️ Use Ground Texture",
    },
    textureRepeat: {
      value: 60.0,
      min: 1,
      max: 100,
      step: 0.5,
      label: "🖼️ Texture Repeat (per chunk)",
    },
    // fBm (Fractional Brownian Motion) controls
    fbmEnabled: {
      value: true,
      label: "🌊 Enable fBm (Fractional Brownian Motion)",
    },
    fbmOctaves: {
      value: 6,
      min: 2,
      max: 10,
      step: 1,
      label: "🌊 fBm Octaves (more = more detail)",
    },
    fbmPersistence: {
      value: 0.5,
      min: 0.1,
      max: 1.0,
      step: 0.05,
      label: "🌊 fBm Persistence (how much each octave contributes)",
    },
    fbmLacunarity: {
      value: 2.0,
      min: 1.5,
      max: 3.0,
      step: 0.1,
      label: "🌊 fBm Lacunarity (frequency scaling between octaves)",
    },
    fbmBaseFrequency: {
      value: 0.0005,
      min: 0.0001,
      max: 0.002,
      step: 0.0001,
      label: "🌊 fBm Base Frequency (overall terrain scale)",
    },
  });

  const { camera } = useThree();
  const [visibleChunks, setVisibleChunks] = useState(new Map());
  const terrainReadyCalledRef = useRef(false);

  useEffect(() => {
    if (onTerrainReady && !terrainReadyCalledRef.current) {
      const shouldTrigger = enableChunks ? visibleChunks.size > 0 : true;
      if (shouldTrigger) {
        terrainReadyCalledRef.current = true;
        const timer = setTimeout(() => {
          const mode = enableChunks
            ? `${visibleChunks.size} chunks`
            : "single terrain";
          console.log(`✅ ProceduralTerrain5 (Shader) ready with ${mode}`);
          onTerrainReady();
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [onTerrainReady, visibleChunks.size, enableChunks]);

  const chunksPerSide = Math.ceil(terrainSize / terrainChunkSize);
  const halfSize = terrainSize / 2;

  // Create simplex noise generators ONCE - shared by all chunks
  const noiseGenerators = useMemo(() => {
    return {
      noise: createNoiseGenerator(terrainSeed),
      noise2: createNoiseGenerator(terrainSeed + 1000),
      noise3: createNoiseGenerator(terrainSeed + 2000),
      noise4: createNoiseGenerator(terrainSeed + 3000),
    };
  }, [terrainSeed]);

  const terrainControls = useMemo(
    () => ({
      mountainIntensity,
      flatnessThreshold,
      flatnessSmooth,
      ridgeSharpness,
      valleyDepth,
      detailAmount,
      biomeVariation: 0.5,
      // fBm controls
      fbmEnabled,
      fbmOctaves,
      fbmPersistence,
      fbmLacunarity,
      fbmBaseFrequency,
    }),
    [
      mountainIntensity,
      flatnessThreshold,
      flatnessSmooth,
      ridgeSharpness,
      valleyDepth,
      detailAmount,
      fbmEnabled,
      fbmOctaves,
      fbmPersistence,
      fbmLacunarity,
      fbmBaseFrequency,
    ]
  );

  useEffect(() => {
    if (onHeightmapReady && noiseGenerators) {
      const heightmapLookup = (x, z) => {
        const height = getTerrainHeight(
          x,
          -z,
          noiseGenerators,
          terrainHeightScale,
          terrainControls
        );
        return height;
      };
      console.log("✅ ProceduralTerrain5 (Shader) heightmap ready");
      onHeightmapReady(heightmapLookup);
    }
  }, [noiseGenerators, terrainHeightScale, terrainControls, onHeightmapReady]);

  const segmentsPerChunk = Math.max(
    10,
    Math.floor((terrainSegments * terrainChunkSize) / terrainSize)
  );

  const getLODSegments = (distance) => {
    if (!enableLOD) return segmentsPerChunk;
    if (distance < terrainLodNear) return segmentsPerChunk;
    if (distance < terrainLodMedium) return Math.floor(segmentsPerChunk / 2);
    return Math.floor(segmentsPerChunk / 4);
  };

  useFrame(() => {
    if (!enableChunks) {
      if (visibleChunks.size > 0) {
        setVisibleChunks(new Map());
      }
      return;
    }

    const cameraPos = camera.position;
    const newVisibleChunks = new Map();

    for (let x = 0; x < chunksPerSide; x++) {
      for (let z = 0; z < chunksPerSide; z++) {
        const chunkMinX = x * terrainChunkSize - halfSize;
        const chunkMaxX = chunkMinX + terrainChunkSize;
        const chunkMinZ = z * terrainChunkSize - halfSize;
        const chunkMaxZ = chunkMinZ + terrainChunkSize;

        const nearestX = Math.max(chunkMinX, Math.min(cameraPos.x, chunkMaxX));
        const nearestZ = Math.max(chunkMinZ, Math.min(cameraPos.z, chunkMaxZ));

        const dx = cameraPos.x - nearestX;
        const dz = cameraPos.z - nearestZ;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (!enableViewDistanceCulling || distance < terrainViewDistance) {
          const lodLevel = getLODSegments(distance);
          const chunkKey = `${x},${z}`;
          newVisibleChunks.set(chunkKey, { x, z, lodLevel, distance });
        }
      }
    }

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
          enableColorNoise={enableColorNoise}
          colorNoiseScale={colorNoiseScale}
          enableTextureNoise={enableTextureNoise}
          textureNoiseScale={textureNoiseScale}
          textureFrequency={textureFrequency}
          valleyColor={valleyColor}
          grassColor={grassColor}
          mountainColor={mountainColor}
          peakColor={peakColor}
          heightValley={heightValley}
          heightGrass={heightGrass}
          heightSlope={heightSlope}
          heightPeak={heightPeak}
          terrainControls={terrainControls}
          groundTexture={groundTexture}
          normalMapTexture={normalMapTexture}
          roughnessMapTexture={roughnessMapTexture}
          textureRepeat={textureRepeat}
          useTexture={useTexture}
        />
      </group>
    );
  }

  return (
    <group>
      {Array.from(visibleChunks.values()).map((chunkData) => {
        const { x, z, lodLevel } = chunkData;
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
            enableColorNoise={enableColorNoise}
            colorNoiseScale={colorNoiseScale}
            enableTextureNoise={enableTextureNoise}
            textureNoiseScale={textureNoiseScale}
            textureFrequency={textureFrequency}
            valleyColor={valleyColor}
            grassColor={grassColor}
            mountainColor={mountainColor}
            peakColor={peakColor}
            heightValley={heightValley}
            heightGrass={heightGrass}
            heightSlope={heightSlope}
            heightPeak={heightPeak}
            terrainControls={terrainControls}
            groundTexture={groundTexture}
            normalMapTexture={normalMapTexture}
            roughnessMapTexture={roughnessMapTexture}
            textureRepeat={textureRepeat}
            useTexture={useTexture}
          />
        );
      })}
    </group>
  );
};
