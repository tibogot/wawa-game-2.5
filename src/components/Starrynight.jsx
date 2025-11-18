import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Trail, Stars as DreiStars } from "@react-three/drei";
import * as THREE from "three";

/**
 * StarryNight Component
 * A reusable interactive starry night effect for React Three Fiber
 *
 * @param {Object} props
 * @param {number} props.starsCount - Number of background stars (default: 80)
 * @param {number} props.starsSpeed - Speed of star movement (default: 0.15)
 * @param {number} props.trailLength - Length of mouse trail (default: 50)
 * @param {number} props.trailSpeed - Speed of trail particles (default: 0.5)
 * @param {number} props.maxDistFromCursor - Max distance variation from cursor (default: 50)
 * @param {string} props.trailColor - Color of trail particles (default: "white")
 * @param {boolean} props.enableTrail - Enable/disable mouse trail (default: true)
 */
export function StarryNight({
  starsCount = 80,
  starsSpeed = 0.15,
  trailLength = 50,
  trailSpeed = 0.5,
  maxDistFromCursor = 50,
  trailColor = "white",
  enableTrail = true,
  ...props
}) {
  return (
    <group {...props}>
      {/* Background stars */}
      <BackgroundStars count={starsCount} speed={starsSpeed} />

      {/* Interactive mouse trail */}
      {enableTrail && (
        <MouseTrail
          length={trailLength}
          speed={trailSpeed}
          maxDist={maxDistFromCursor}
          color={trailColor}
        />
      )}

      {/* Gradient background plane */}
      <GradientBackground />
    </group>
  );
}

/**
 * Background Stars Component
 * Renders slowly drifting stars in the background
 */
function BackgroundStars({ count, speed }) {
  const starsRef = useRef();

  // Generate random star positions
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = -Math.random() * 10 - 5;
    }
    return pos;
  }, [count]);

  // Generate random star sizes
  const sizes = useMemo(() => {
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      s[i] = Math.random() * 0.05 + 0.02;
    }
    return s;
  }, [count]);

  // Animate stars drifting upward
  useFrame((state) => {
    if (!starsRef.current) return;

    const positions = starsRef.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] += speed * 0.01;

      // Wrap around when star goes too high
      if (positions[i * 3 + 1] > 10) {
        positions[i * 3 + 1] = -10;
      }
    }

    starsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        sizeAttenuation
        color="white"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Mouse Trail Component
 * Creates interactive particle trails that follow the mouse
 */
function MouseTrail({ length, speed, maxDist, color }) {
  const { viewport, pointer } = useThree();
  const dotsRef = useRef([]);
  const dotMeshesRef = useRef([]);
  const linesRef = useRef();
  const mousePos = useRef({ x: 0, y: 0, z: 0 });
  const lastDotTime = useRef(0);
  const dotIdCounter = useRef(0);

  // Create dot geometry once
  const dotGeometry = useMemo(() => new THREE.SphereGeometry(0.02, 8, 8), []);

  useFrame((state, delta) => {
    // Update mouse position in 3D space
    mousePos.current.x = (pointer.x * viewport.width) / 2;
    mousePos.current.y = (pointer.y * viewport.height) / 2;
    mousePos.current.z = 0;

    // Create new dot at intervals
    const now = state.clock.elapsedTime;
    if (
      now - lastDotTime.current > 0.05 &&
      (Math.abs(pointer.x) > 0.001 || Math.abs(pointer.y) > 0.001)
    ) {
      lastDotTime.current = now;

      // Add variation around cursor
      const xVar = (Math.random() - 0.5) * maxDist * 0.01;
      const yVar = (Math.random() - 0.5) * maxDist * 0.01;

      const newDot = {
        id: dotIdCounter.current++,
        position: new THREE.Vector3(
          mousePos.current.x + xVar,
          mousePos.current.y + yVar,
          mousePos.current.z
        ),
        velocity: new THREE.Vector3(
          Math.cos(THREE.MathUtils.degToRad(Math.random() * 140 + 200)) *
            speed *
            0.1,
          Math.sin(THREE.MathUtils.degToRad(Math.random() * 140 + 200)) *
            speed *
            0.1,
          0
        ),
        alpha: 0.5,
        mesh: null,
      };

      // Create mesh for dot
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: newDot.alpha,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(dotGeometry, material);
      mesh.position.copy(newDot.position);

      newDot.mesh = mesh;
      dotsRef.current.push(newDot);
      dotMeshesRef.current.push(mesh);

      // Limit number of dots
      if (dotsRef.current.length > length) {
        const removed = dotsRef.current.shift();
        const removedMesh = dotMeshesRef.current.shift();
        if (removed.mesh) {
          removed.mesh.geometry.dispose();
          removed.mesh.material.dispose();
        }
      }
    }

    // Update existing dots
    dotsRef.current.forEach((dot, i) => {
      dot.alpha -= 0.005;
      dot.position.add(dot.velocity);

      if (dot.mesh) {
        dot.mesh.position.copy(dot.position);
        dot.mesh.material.opacity = dot.alpha;
      }

      // Remove faded dots
      if (dot.alpha <= 0) {
        if (dot.mesh) {
          dot.mesh.geometry.dispose();
          dot.mesh.material.dispose();
        }
        dotsRef.current.splice(i, 1);
        dotMeshesRef.current.splice(i, 1);
      }
    });

    // Update line connections between dots
    if (linesRef.current && dotsRef.current.length > 1) {
      const points = [];
      dotsRef.current.forEach((dot) => {
        points.push(dot.position);
      });

      if (points.length > 1) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        linesRef.current.geometry.dispose();
        linesRef.current.geometry = geometry;
      }
    }
  });

  return (
    <group>
      {/* Render dots */}
      {dotMeshesRef.current.map((mesh, i) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}

      {/* Line connecting dots */}
      <line ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </line>
    </group>
  );
}

/**
 * Gradient Background Component
 * Renders a gradient from black to blue
 */
function GradientBackground() {
  const { viewport } = useThree();

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color1: { value: new THREE.Color(0x000000) },
        color2: { value: new THREE.Color(0x5788fe) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color1;
        uniform vec3 color2;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(mix(color2, color1, vUv.y), 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
  }, []);

  return (
    <mesh position={[0, 0, -10]} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}

export default StarryNight;
