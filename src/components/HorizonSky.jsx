import React, { useRef, useMemo } from "react";
import * as THREE from "three";

const HorizonSky = ({
  topColor = "#0077ff",
  bottomColor = "#ffffff",
  offset = 33,
  exponent = 0.6,
  radius = 4000,
}) => {
  const meshRef = useRef();

  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(topColor) },
      bottomColor: { value: new THREE.Color(bottomColor) },
      offset: { value: offset },
      exponent: { value: exponent },
    }),
    [topColor, bottomColor, offset, exponent]
  );

  const vertexShader = `
    varying vec3 vWorldPosition;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;

    varying vec3 vWorldPosition;

    void main() {
      float h = normalize(vWorldPosition + offset).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
    }
  `;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 32, 15]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export default HorizonSky;

// Example usage in your scene:
// <HorizonSky
//   topColor="#0077ff"
//   bottomColor="#ffffff"
//   offset={33}
//   exponent={0.6}
//   radius={4000}
// />
