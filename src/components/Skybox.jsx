import React, { useMemo } from "react";
import * as THREE from "three";

export const Skybox = () => {
  const skyboxTexture = useMemo(() => {
    const loader = new THREE.CubeTextureLoader();

    // Load the 6 skybox images
    const texture = loader.load([
      "/textures/skybox/posx.jpg", // right
      "/textures/skybox/negx.jpg", // left
      "/textures/skybox/posy.jpg", // top
      "/textures/skybox/negy.jpg", // bottom
      "/textures/skybox/posz.jpg", // front
      "/textures/skybox/negz.jpg", // back
    ]);

    return texture;
  }, []);

  // Create a large box geometry that encompasses the entire terrain
  // Size set to 5000 to fully contain a 3000x3000 terrain with room to spare
  const skyboxGeometry = useMemo(
    () => new THREE.BoxGeometry(5000, 5000, 5000),
    []
  );

  // Shader material that renders the skybox from the inside
  const skyboxMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        skybox: { value: skyboxTexture },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform samplerCube skybox;
        varying vec3 vWorldPosition;
        
        void main() {
          gl_FragColor = texture(skybox, normalize(vWorldPosition));
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [skyboxTexture]);

  return <mesh geometry={skyboxGeometry} material={skyboxMaterial} />;
};
