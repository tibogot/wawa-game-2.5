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

      {/* Automatic timed shapes */}
      {enableTrail && (
        <AutomaticShapes
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
 * Renders slowly drifting stars in the background on a flat plane
 */
function BackgroundStars({ count, speed }) {
  const starsRef = useRef();
  const { viewport } = useThree();

  // Generate random star positions on a flat plane (z = 0) covering full viewport
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    // Use much larger area to cover full screen - similar to reference WIDTH/HEIGHT
    const width = viewport.width * 50; // Much larger spread
    const height = viewport.height * 50;

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * width; // Full width spread
      pos[i * 3 + 1] = (Math.random() - 0.5) * height; // Full height spread
      pos[i * 3 + 2] = 0; // All stars on same plane (z = 0)
    }
    return pos;
  }, [count, viewport.width, viewport.height]);

  // Generate random star sizes (like reference: r = 1-2, with alpha variation)
  const sizes = useMemo(() => {
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      s[i] = Math.random() * 0.1 + 0.05; // Size between 0.05-0.15
    }
    return s;
  }, [count]);

  // Animate stars drifting upward (like reference: y -= 0.15 + speed)
  useFrame((state, delta) => {
    if (!starsRef.current) return;

    const positions = starsRef.current.geometry.attributes.position.array;
    const height = viewport.height * 50;
    const moveSpeed = (0.15 + speed) * delta * 10;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= moveSpeed;

      // Wrap around when star goes too high (like reference)
      if (positions[i * 3 + 1] < -height / 2) {
        positions[i * 3 + 1] = height / 2;
        positions[i * 3] = (Math.random() - 0.5) * viewport.width * 50; // Reset X position
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
        size={2}
        sizeAttenuation
        color="white"
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Automatic Shapes Component
 * Creates automatic timed shapes in the sky (not hover-based)
 */
function AutomaticShapes({ length, speed, maxDist, color }) {
  const shapesRef = useRef([]);
  const shapeMeshesRef = useRef([]);
  const linesRef = useRef();
  const lastShapeTime = useRef(0);
  const shapeIdCounter = useRef(0);
  const shapeInterval = useRef(2 + Math.random() * 3); // Random interval between 2-5 seconds
  const { viewport } = useThree();

  // Create dot geometry once
  const dotGeometry = useMemo(() => new THREE.SphereGeometry(0.1, 8, 8), []);

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;

    // Create new shape automatically at timed intervals
    if (now - lastShapeTime.current > shapeInterval.current) {
      lastShapeTime.current = now;
      shapeInterval.current = 2 + Math.random() * 3; // Next shape in 2-5 seconds

      // Random center position for the shape (full viewport area)
      const centerX = (Math.random() - 0.5) * viewport.width * 10;
      const centerY =
        (Math.random() - 0.5) * viewport.height * 5 + viewport.height * 2; // Prefer upper area
      const centerZ = 0;

      // Create a shape (circle or star pattern)
      const shapeType = Math.random() > 0.5 ? "circle" : "star";
      const numPoints = shapeType === "circle" ? 12 : 8;
      const radius = 30 + Math.random() * 40;

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        let x, y;

        if (shapeType === "circle") {
          x = centerX + Math.cos(angle) * radius;
          y = centerY + Math.sin(angle) * radius;
        } else {
          // Star pattern
          const outerRadius = radius;
          const innerRadius = radius * 0.5;
          const r = i % 2 === 0 ? outerRadius : innerRadius;
          x = centerX + Math.cos(angle) * r;
          y = centerY + Math.sin(angle) * r;
        }

        const newDot = {
          id: shapeIdCounter.current++,
          position: new THREE.Vector3(x, y, centerZ),
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * speed * 0.5,
            (Math.random() - 0.5) * speed * 0.5,
            0
          ),
          alpha: 0.8,
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
        shapesRef.current.push(newDot);
        shapeMeshesRef.current.push(mesh);
      }
    }

    // Update existing shapes
    shapesRef.current.forEach((dot, i) => {
      dot.alpha -= delta * 0.3; // Fade out over time
      dot.position.add(dot.velocity.clone().multiplyScalar(delta));

      if (dot.mesh) {
        dot.mesh.position.copy(dot.position);
        dot.mesh.material.opacity = Math.max(0, dot.alpha);
      }

      // Remove faded shapes
      if (dot.alpha <= 0) {
        if (dot.mesh) {
          dot.mesh.geometry.dispose();
          dot.mesh.material.dispose();
        }
        shapesRef.current.splice(i, 1);
        shapeMeshesRef.current.splice(i, 1);
      }
    });

    // Update line connections between dots in each shape
    if (linesRef.current && shapesRef.current.length > 1) {
      const points = [];
      shapesRef.current.forEach((dot) => {
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
      {/* Render shape dots */}
      {shapeMeshesRef.current.map((mesh, i) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}

      {/* Line connecting dots */}
      <line ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </line>
    </group>
  );
}

/**
 * Gradient Background Component
 * Renders a gradient from black to blue, scaled to cover large area
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

  // Scale to cover large background area
  const scale = Math.max(viewport.width, viewport.height) * 10;

  return (
    <mesh position={[0, 0, 0]} scale={[scale, scale, 1]}>
      <planeGeometry args={[1, 1]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}

export default StarryNight;
