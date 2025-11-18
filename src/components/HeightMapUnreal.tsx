import React, {
  useRef,
  useMemo,
  forwardRef,
  useEffect,
  useCallback,
} from "react";
import { useLoader } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { TextureLoader } from "three";
import * as THREE from "three";
import { useControls } from "leva";

interface HeightMapUnrealProps {
  size?: number;
  segments?: number;
  heightScale?: number;
  position?: [number, number, number];
  scale?: number;
  onHeightmapReady?: (fn: (x: number, z: number) => number) => void;
}

// Helper function to create gradient color based on height
function getGradientColor(
  height: number,
  lowColor: string,
  midColor: string,
  highColor: string,
  midPoint: number
): THREE.Color {
  const low = new THREE.Color(lowColor);
  const mid = new THREE.Color(midColor);
  const high = new THREE.Color(highColor);

  // Normalize height to 0-1 range
  let t = Math.max(0, Math.min(1, height));

  // Create smooth gradient from low -> mid -> high with adjustable mid point
  let color: THREE.Color;
  if (t < midPoint) {
    // Blend between low and mid (0 -> midPoint)
    const blendT = t / midPoint;
    color = low.clone().lerp(mid, blendT);
  } else {
    // Blend between mid and high (midPoint -> 1)
    const blendT = (t - midPoint) / (1 - midPoint);
    color = mid.clone().lerp(high, blendT);
  }

  return color;
}

export const HeightMapUnreal = forwardRef<THREE.Mesh, HeightMapUnrealProps>(
  (
    {
      size: initialSize = 2000,
      segments: initialSegments = 200,
      heightScale: initialHeightScale = 100,
      position = [0, 0, 0],
      scale = 1,
      onHeightmapReady,
      ...props
    },
    ref
  ) => {
    const group = useRef<THREE.Group>(null);

    // Terrain geometry controls
    const { size, segments, heightScale, centerRegionSize } = useControls(
      "🗻 Terrain Geometry",
      {
        size: {
          value: initialSize,
          min: 500,
          max: 10000,
          step: 100,
          label: "📏 Size (Width × Depth)",
        },
        segments: {
          value: initialSegments,
          min: 50,
          max: 500,
          step: 10,
          label: "🔲 Segments (Resolution)",
        },
        heightScale: {
          value: initialHeightScale,
          min: 0,
          max: 500,
          step: 10,
          label: "📐 Height Scale",
        },
        centerRegionSize: {
          value: 5,
          min: 1,
          max: 20,
          step: 1,
          label: "🎯 Center Peak Detection",
        },
      }
    );

    // Gradient color controls
    const { enableGradient, lowColor, midColor, highColor, midPoint } =
      useControls("🗻 Terrain Gradient", {
        enableGradient: {
          value: true,
          label: "Enable Height Gradient",
        },
        lowColor: {
          value: "#4a6741",
          label: "Low (Valley) Color",
        },
        midColor: {
          value: "#8b7355",
          label: "Mid (Hill) Color",
        },
        highColor: {
          value: "#d4c5b9",
          label: "High (Peak) Color",
        },
        midPoint: {
          value: 0.5,
          min: 0.1,
          max: 0.9,
          step: 0.05,
          label: "🎚️ Gradient Mid Point",
        },
      });

    // Load the heightmap texture
    const heightmapTexture = useLoader(
      TextureLoader,
      "/textures/unreal-heightmap.png"
    ) as THREE.Texture;

    // Cache the heightmap image data ONCE - this is expensive! (Same pattern as ZeldaTerrain2)
    const heightmapImageData = useMemo(() => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      canvas.width = heightmapTexture.image.width;
      canvas.height = heightmapTexture.image.height;
      ctx.drawImage(heightmapTexture.image, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }, [heightmapTexture]);

    // Store height data for lookup function (processed once, shared with grass)
    const heightData = useMemo(() => {
      if (!heightmapImageData) return null;

      const data = heightmapImageData.data;
      const canvas = {
        width: heightmapImageData.width,
        height: heightmapImageData.height,
      };

      // Find min and max heights for normalization
      const heights: number[] = [];
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const pixelIndex = (y * canvas.width + x) * 4;
          const height = data[pixelIndex] / 255;
          heights.push(height);
        }
      }

      let minHeight = heights[0];
      let maxHeight = heights[0];
      for (let i = 1; i < heights.length; i++) {
        if (heights[i] < minHeight) minHeight = heights[i];
        if (heights[i] > maxHeight) maxHeight = heights[i];
      }
      const heightRange = maxHeight - minHeight;

      // Find max height at center region
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      let maxCenterHeight = 0;

      for (let dx = -centerRegionSize; dx <= centerRegionSize; dx++) {
        for (let dy = -centerRegionSize; dy <= centerRegionSize; dy++) {
          const x = Math.max(0, Math.min(canvas.width - 1, centerX + dx));
          const y = Math.max(0, Math.min(canvas.height - 1, centerY + dy));
          const pixelIndex = (y * canvas.width + x) * 4;
          const height = data[pixelIndex] / 255;
          if (height > maxCenterHeight) {
            maxCenterHeight = height;
          }
        }
      }

      // Calculate offset to place center peak at Y=0
      const normalizedMaxCenterHeight =
        (maxCenterHeight - minHeight) / heightRange;
      const peakOffset = -(normalizedMaxCenterHeight * heightScale);

      // Create normalized height array
      const normalizedHeights: number[] = [];
      for (let i = 0; i < heights.length; i++) {
        const normalizedHeight =
          heightRange > 0 ? (heights[i] - minHeight) / heightRange : 0;
        normalizedHeights.push(normalizedHeight * heightScale + peakOffset);
      }

      return {
        heights: normalizedHeights,
        width: canvas.width,
        height: canvas.height,
        minHeight,
        maxHeight,
        heightRange,
        peakOffset,
      };
    }, [heightmapImageData, heightScale, centerRegionSize]);

    // Create heightmap lookup function for grass and other components (SAME as ZeldaTerrain2!)
    const heightmapLookup = useMemo(() => {
      if (!heightData) return null;

      return (x: number, z: number): number => {
        // Convert world coordinates to heightmap coordinates
        const normalizedX = (x + size / 2) / size;
        const normalizedZ = (z + size / 2) / size;

        // Clamp to valid range
        const clampedX = Math.max(0, Math.min(1, normalizedX));
        const clampedZ = Math.max(0, Math.min(1, normalizedZ));

        // Convert to pixel coordinates
        const pixelX = Math.floor(clampedX * (heightData.width - 1));
        const pixelZ = Math.floor(clampedZ * (heightData.height - 1));

        // Get height value from stored height data
        const index = pixelZ * heightData.width + pixelX;
        return heightData.heights[index] || 0;
      };
    }, [heightData, size]);

    // Notify parent component when heightmap lookup is ready (SAME as ZeldaTerrain2!)
    useEffect(() => {
      if (heightmapLookup && onHeightmapReady) {
        console.log(
          "✅ HeightMapUnreal: Heightmap lookup ready, notifying Map3"
        );
        onHeightmapReady(heightmapLookup);
      }
    }, [heightmapLookup, onHeightmapReady]);

    // Create geometry with heightmap displacement
    const geometry = useMemo(() => {
      const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

      // Use cached heightmap image data (no canvas recreation!)
      if (!heightmapImageData) return geometry;

      const data = heightmapImageData.data;
      const canvas = {
        width: heightmapImageData.width,
        height: heightmapImageData.height,
      };

      // Get vertex positions
      const positions = geometry.attributes.position.array;

      // First pass: collect all heights to find min/max for normalization
      const heights: number[] = [];
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 1];

        // Convert world coordinates to texture coordinates
        const u = (x + size / 2) / size; // Normalize to 0-1
        const v = (z + size / 2) / size; // Normalize to 0-1

        // Clamp to valid range
        const clampedU = Math.max(0, Math.min(1, u));
        const clampedV = Math.max(0, Math.min(1, v));

        // Get pixel coordinates
        const pixelX = Math.floor(clampedU * (canvas.width - 1));
        const pixelY = Math.floor(clampedV * (canvas.height - 1));

        // Get pixel index (RGBA format)
        const pixelIndex = (pixelY * canvas.width + pixelX) * 4;

        // Use red channel for height (grayscale heightmap)
        const height = data[pixelIndex] / 255; // Normalize to 0-1
        heights.push(height);
      }

      // Find min and max heights for normalization (avoid spread operator with large arrays)
      let minHeight = heights[0];
      let maxHeight = heights[0];
      for (let i = 1; i < heights.length; i++) {
        if (heights[i] < minHeight) minHeight = heights[i];
        if (heights[i] > maxHeight) maxHeight = heights[i];
      }
      const heightRange = maxHeight - minHeight;

      // Find max height at center region (for centering on Y=0)
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      let maxCenterHeight = 0;

      for (let dx = -centerRegionSize; dx <= centerRegionSize; dx++) {
        for (let dy = -centerRegionSize; dy <= centerRegionSize; dy++) {
          const x = Math.max(0, Math.min(canvas.width - 1, centerX + dx));
          const y = Math.max(0, Math.min(canvas.height - 1, centerY + dy));
          const pixelIndex = (y * canvas.width + x) * 4;
          const height = data[pixelIndex] / 255;
          if (height > maxCenterHeight) {
            maxCenterHeight = height;
          }
        }
      }

      // Calculate offset to place center peak at Y=0
      const normalizedMaxCenterHeight =
        (maxCenterHeight - minHeight) / heightRange;
      const peakOffset = -(normalizedMaxCenterHeight * heightScale);

      // Second pass: apply normalized height displacement and colors
      let heightIndex = 0;
      const colors: number[] = [];

      for (let i = 0; i < positions.length; i += 3) {
        const rawHeight = heights[heightIndex++];

        // Normalize height so lowest point is at 0 and highest point uses full heightScale
        const normalizedHeight =
          heightRange > 0 ? (rawHeight - minHeight) / heightRange : 0;

        // Apply height displacement with peak at center positioned at Y=0
        positions[i + 2] = normalizedHeight * heightScale + peakOffset;

        // Store normalized height for color mapping
        colors.push(normalizedHeight);
      }

      // Apply gradient colors to vertices
      if (enableGradient) {
        const colorArray = new Float32Array(positions.length);
        for (let i = 0; i < colors.length; i++) {
          const color = getGradientColor(
            colors[i],
            lowColor,
            midColor,
            highColor,
            midPoint
          );
          colorArray[i * 3] = color.r;
          colorArray[i * 3 + 1] = color.g;
          colorArray[i * 3 + 2] = color.b;
        }
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(colorArray, 3)
        );
      }

      // Update the geometry
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();

      return geometry;
    }, [
      heightmapImageData,
      size,
      segments,
      heightScale,
      centerRegionSize,
      enableGradient,
      lowColor,
      midColor,
      highColor,
      midPoint,
    ]);

    // Create material with the heightmap as texture and gradient
    const material = useMemo(() => {
      const mat = new THREE.MeshStandardMaterial({
        metalness: 0.1,
        roughness: 0.8,
        envMapIntensity: 1,
      });

      if (enableGradient) {
        // Use vertex colors for gradient
        mat.vertexColors = true;
      } else {
        // Use heightmap texture
        mat.map = heightmapTexture;
      }

      return mat;
    }, [heightmapTexture, enableGradient]);

    return (
      <group ref={group} {...props}>
        <RigidBody type="fixed" colliders="trimesh">
          <mesh
            ref={ref}
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
  }
);
