import React, { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import CustomShaderMaterial from "three-custom-shader-material";
import * as THREE from "three";

// Create a shared texture instance to avoid multiple loads
let sharedTexture: THREE.Texture | null = null;

export const TileMaterial = ({
  textureScale = 1.0,
  gradientIntensity = 0.5,
  gradientBias = 0.0,
}: {
  textureScale?: number;
  gradientIntensity?: number;
  gradientBias?: number;
}) => {
  // Load grid texture (shared instance)
  const gridTexture = useTexture("/textures/grid.png");

  // Configure texture immediately
  gridTexture.wrapS = gridTexture.wrapT = THREE.RepeatWrapping;
  gridTexture.anisotropy = 16;

  // Memoize uniforms - no object-specific offsets needed
  const uniforms = useMemo(
    () => ({
      gridTexture: { value: gridTexture },
      gradientIntensity: { value: gradientIntensity },
      textureScale: { value: textureScale },
      gradientBias: { value: gradientBias },
    }),
    [gridTexture, gradientIntensity, textureScale, gradientBias]
  );

  return (
    <CustomShaderMaterial
      baseMaterial={THREE.MeshStandardMaterial}
      vertexShader={`
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
        }
      `}
      fragmentShader={`
        uniform sampler2D gridTexture;
        uniform float gradientIntensity;
        uniform float textureScale;
        uniform float gradientBias;
        varying vec2 vUv;
        
        float hash12(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        float remap(float value, float oldMin, float oldMax, float newMin, float newMax) {
          return newMin + (value - oldMin) * (newMax - newMin) / (oldMax - oldMin);
        }
        
        void main() {
          // Use standard UV coordinates like default Three.js materials
          vec2 objectUV = vUv * textureScale;
          
          float grid1 = texture2D(gridTexture, objectUV * 0.125).r;
          float grid2 = texture2D(gridTexture, objectUV * 1.25).r;
          
          float gridHash1 = hash12(floor(objectUV * 1.25));
          
          float variationAmount = gradientIntensity * 0.2;
          
          float baseShade = clamp(
            0.45 + remap(gridHash1, 0.0, 1.0, -variationAmount, variationAmount) + gradientBias,
            0.0,
            1.0
          );

          vec3 gridColour = mix(
            vec3(baseShade), 
            vec3(0.08), 
            grid2
          );
          gridColour = mix(gridColour, vec3(0.0), grid1);
          
          csm_DiffuseColor = vec4(gridColour, 1.0);
        }
      `}
      uniforms={uniforms}
      roughness={1.0}
      metalness={0.0}
    />
  );
};

// Helper component to ensure geometry has proper UVs
export const MeshWithTileMaterial = ({
  children,
  textureScale = 1.0,
  ...props
}: {
  children: React.ReactElement;
  textureScale?: number;
  [key: string]: any;
}) => {
  const geomRef = React.useRef<THREE.BufferGeometry>(null);

  React.useEffect(() => {
    if (geomRef.current) {
      const geom = geomRef.current;

      // Check if geometry has UVs, if not compute them
      if (!geom.attributes.uv) {
        console.log("Generating UVs for geometry");
        geom.computeVertexNormals();

        // Generate proper UVs based on geometry type
        const positions = geom.attributes.position;
        const uvs: number[] = [];

        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          const z = positions.getZ(i);

          // Better UV generation for different faces
          const u = (x + 1) * 0.5; // Map -1 to 1 range to 0 to 1
          const v = (z + 1) * 0.5; // Map -1 to 1 range to 0 to 1
          uvs.push(u, v);
        }

        geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      }
    }
  }, []);

  return (
    <mesh {...props}>
      <primitive object={children} ref={geomRef} />
      <TileMaterial textureScale={textureScale} />
    </mesh>
  );
};

// Example usage component
export default function TileMaterialDemo() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <TileMaterial textureScale={2.0} />
      </mesh>

      {/* Wall */}
      <mesh position={[0, 2.5, -5]}>
        <planeGeometry args={[10, 5]} />
        <TileMaterial textureScale={2.0} />
      </mesh>

      {/* Box with automatic UV fix */}
      <MeshWithTileMaterial position={[3, 1, 0]} textureScale={1.5}>
        <boxGeometry args={[2, 2, 2]} />
      </MeshWithTileMaterial>

      {/* Sphere */}
      <mesh position={[-3, 1.5, 0]}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <TileMaterial textureScale={3.0} />
      </mesh>
    </group>
  );
}
