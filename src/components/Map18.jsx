import {
  RigidBody,
  CuboidCollider,
  CylinderCollider,
} from "@react-three/rapier";
import { useRef, useMemo, useEffect, useState } from "react";
import { useControls, folder } from "leva";
import { Stars, useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import ClaudeGrassQuick from "./ClaudeGrassQuick";
import ClaudeGrassQuick2 from "./ClaudeGrassQuick2";
import ClaudeGrassQuick5 from "./ClaudeGrassQuick5";
import useClaudeGrassQuickControls from "./useClaudeGrassQuickControls";
import useClaudeGrassQuick2Controls from "./useClaudeGrassQuick2Controls";
import useClaudeGrassQuick5Controls from "./useClaudeGrassQuick5Controls";
import { HeightFog } from "./HeightFog";
import { useHeightFogControls } from "./useHeightFogControls";
import { useLensFlareControls } from "./useLensFlareControls";
import LensFlare from "./LensFlare";
import { Skybox } from "./Skybox";
import HorizonSky from "./HorizonSky";
import { TileCube } from "./TileCube";
import { PhysicsDebugCubes } from "./PhysicsDebugCubes";
import * as THREE from "three";
import { TileMaterial } from "./TileMaterial";
import { TILE_REFERENCE_SCALE, TILE_DENSITY } from "./tileMaterialConfig";

// 2.5D: Character spawns at z=-80, so parkour objects should be positioned along X-axis (left/right movement)
// with Z-axis variations for depth layering (keep close to -80 for gameplay)
const CHARACTER_Z = -80;

const TILE_WORLD_UNIT = 1 / TILE_DENSITY;

// GLB model paths
const CYLINDER_PATH = "/models/parkour/cylinder.glb";
const PARKOUR_PATH = "/models/parkour/parkour1.glb";
const HOLEWALL_PATH = "/models/parkour/holewall.glb";
useGLTF.preload(CYLINDER_PATH);
useGLTF.preload(PARKOUR_PATH);
useGLTF.preload(HOLEWALL_PATH);

// Helper types (using JSDoc for JSX file)
/**
 * @typedef {Object} ExtractedMesh
 * @property {THREE.BufferGeometry} geometry
 * @property {[number, number, number]} position
 * @property {[number, number, number]} rotation
 * @property {[number, number, number]} scale
 * @property {number} textureScale
 */

/**
 * @typedef {Object} SharedTileProps
 * @property {[number, number, number]} [position]
 * @property {number} [textureScale]
 */

// Helper functions for tiled geometry
/**
 * @param {number} width
 * @param {number} height
 * @param {number} depth
 * @returns {THREE.BufferGeometry}
 */
const createTiledBoxGeometry = (width, height, depth) => {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const positionAttr = geometry.attributes.position;
  const normalAttr = geometry.attributes.normal;
  const uvAttr = geometry.attributes.uv;

  const positionVector = new THREE.Vector3();
  const normalVector = new THREE.Vector3();

  for (let i = 0; i < uvAttr.count; i++) {
    positionVector.fromBufferAttribute(positionAttr, i);
    normalVector.fromBufferAttribute(normalAttr, i);

    const absNormalX = Math.abs(normalVector.x);
    const absNormalY = Math.abs(normalVector.y);
    const absNormalZ = Math.abs(normalVector.z);

    if (absNormalX >= absNormalY && absNormalX >= absNormalZ) {
      const u = (positionVector.z + depth * 0.5) / TILE_WORLD_UNIT;
      const v = (positionVector.y + height * 0.5) / TILE_WORLD_UNIT;
      uvAttr.setXY(i, u, v);
    } else if (absNormalY >= absNormalX && absNormalY >= absNormalZ) {
      const u = (positionVector.x + width * 0.5) / TILE_WORLD_UNIT;
      const v = (positionVector.z + depth * 0.5) / TILE_WORLD_UNIT;
      uvAttr.setXY(i, u, v);
    } else {
      const u = (positionVector.x + width * 0.5) / TILE_WORLD_UNIT;
      const v = (positionVector.y + height * 0.5) / TILE_WORLD_UNIT;
      uvAttr.setXY(i, u, v);
    }
  }

  uvAttr.needsUpdate = true;
  return geometry;
};

/**
 * @param {[number, number, number]} size
 * @returns {THREE.BufferGeometry}
 */
const useTiledBoxGeometry = (size) => {
  const [width, height, depth] = size;

  const geometry = useMemo(
    () => createTiledBoxGeometry(width, height, depth),
    [width, height, depth]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return geometry;
};

/**
 * @param {number} radius
 * @param {number} height
 * @param {number} [radialSegments=48]
 * @returns {THREE.BufferGeometry}
 */
const createTiledCylinderGeometry = (radius, height, radialSegments = 48) => {
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    radialSegments,
    1,
    false
  );

  const positionAttr = geometry.attributes.position;
  const normalAttr = geometry.attributes.normal;
  const uvAttr = geometry.attributes.uv;

  const positionVector = new THREE.Vector3();
  const normalVector = new THREE.Vector3();
  const circumference = 2 * Math.PI * radius;

  for (let i = 0; i < uvAttr.count; i++) {
    positionVector.fromBufferAttribute(positionAttr, i);
    normalVector.fromBufferAttribute(normalAttr, i);

    if (Math.abs(normalVector.y) < 0.5) {
      const angle = Math.atan2(positionVector.z, positionVector.x);
      const wrappedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
      const distanceAlong = (wrappedAngle / (Math.PI * 2)) * circumference;
      const u = distanceAlong / TILE_WORLD_UNIT;
      const v = (positionVector.y + height * 0.5) / TILE_WORLD_UNIT;
      uvAttr.setXY(i, u, v);
    } else {
      const u = (positionVector.x + radius) / TILE_WORLD_UNIT;
      const v = (positionVector.z + radius) / TILE_WORLD_UNIT;
      uvAttr.setXY(i, u, v);
    }
  }

  uvAttr.needsUpdate = true;
  return geometry;
};

/**
 * @param {number} radius
 * @param {number} height
 * @param {number} [radialSegments=48]
 * @returns {THREE.BufferGeometry}
 */
const useTiledCylinderGeometry = (radius, height, radialSegments = 48) => {
  const geometry = useMemo(
    () => createTiledCylinderGeometry(radius, height, radialSegments),
    [radius, height, radialSegments]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return geometry;
};

/**
 * @param {THREE.Group} scene
 * @param {(geometry: THREE.BufferGeometry, meshScale: THREE.Vector3) => void} [adjustGeometry]
 * @returns {ExtractedMesh[]}
 */
const createMeshEntries = (scene, adjustGeometry) => {
  const results = [];
  scene.updateMatrixWorld(true);

  scene.traverse((child) => {
    if (child.isMesh) {
      const mesh = child;
      const geometry = mesh.geometry.clone();
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();

      if (adjustGeometry) {
        adjustGeometry(geometry, mesh.scale.clone());
        geometry.computeBoundingBox();
      }

      const size = new THREE.Vector3();
      geometry.boundingBox?.getSize(size);
      size.multiply(mesh.scale);

      const spanX = Math.abs(size.x);
      const spanZ = Math.abs(size.z);
      const representativeSpan =
        spanX > 0 && spanZ > 0
          ? (spanX + spanZ) * 0.5
          : Math.max(spanX, spanZ, 1);

      const localPosition = mesh.position.clone();
      const localRotation = new THREE.Euler(
        mesh.rotation.x,
        mesh.rotation.y,
        mesh.rotation.z
      );
      const localScale = mesh.scale.clone();

      results.push({
        geometry,
        position: [localPosition.x, localPosition.y, localPosition.z],
        rotation: [localRotation.x, localRotation.y, localRotation.z],
        scale: [localScale.x, localScale.y, localScale.z],
        textureScale: representativeSpan * TILE_DENSITY,
      });
    }
  });

  return results;
};

// Parkour components
/**
 * @param {SharedTileProps} props
 */
const CylinderTile = ({ position = [0, 0, 0] }) => {
  const { scene } = useGLTF(CYLINDER_PATH);
  const meshes = useMemo(() => createMeshEntries(scene), [scene]);

  return (
    <RigidBody
      type="fixed"
      colliders="trimesh"
      position={position}
      friction={1}
      restitution={0}
    >
      {meshes.map((mesh, index) => (
        <mesh
          key={index}
          geometry={mesh.geometry}
          position={mesh.position}
          rotation={mesh.rotation}
          scale={mesh.scale}
          castShadow
          receiveShadow
        >
          <TileMaterial
            textureScale={mesh.textureScale}
            gradientBias={-0.5}
            gradientIntensity={2}
          />
        </mesh>
      ))}
    </RigidBody>
  );
};

/**
 * @param {SharedTileProps} props
 */
const ParkourTile = ({ position = [0, 0, 0] }) => {
  const { scene } = useGLTF(PARKOUR_PATH);

  const meshes = useMemo(
    () =>
      createMeshEntries(scene, (geometry, meshScale) => {
        const boundingBox = geometry.boundingBox;
        if (!boundingBox) return;

        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        size.multiply(meshScale);

        if (size.y > 0) {
          const targetHeight = 2;
          const verticalScale = targetHeight / size.y;
          geometry.scale(1, verticalScale, 1);
        }
      }),
    [scene]
  );

  return (
    <RigidBody
      type="fixed"
      colliders="trimesh"
      position={position}
      friction={1}
      restitution={0}
    >
      {meshes.map((mesh, index) => (
        <mesh
          key={index}
          geometry={mesh.geometry}
          position={mesh.position}
          rotation={mesh.rotation}
          scale={mesh.scale}
          castShadow
          receiveShadow
        >
          <TileMaterial
            textureScale={mesh.textureScale}
            gradientBias={-0.5}
            gradientIntensity={2}
          />
        </mesh>
      ))}
    </RigidBody>
  );
};

/**
 * @param {SharedTileProps} props
 */
const HoleWallTile = ({ position = [0, 0, 0] }) => {
  const { scene } = useGLTF(HOLEWALL_PATH);
  const meshes = useMemo(() => createMeshEntries(scene), [scene]);

  return (
    <RigidBody
      type="fixed"
      colliders="trimesh"
      position={position}
      friction={1}
      restitution={0}
    >
      {meshes.map((mesh, index) => (
        <mesh
          key={index}
          geometry={mesh.geometry}
          position={mesh.position}
          rotation={mesh.rotation}
          scale={mesh.scale}
          castShadow
          receiveShadow
        >
          <TileMaterial
            textureScale={mesh.textureScale}
            gradientBias={-0.5}
            gradientIntensity={2}
          />
        </mesh>
      ))}
    </RigidBody>
  );
};

/**
 * @typedef {Object} WallSegmentProps
 * @property {number} length
 * @property {number} height
 * @property {number} thickness
 * @property {[number, number, number]} position
 * @property {"x" | "z"} orientation
 */

/**
 * @param {WallSegmentProps} props
 */
const WallSegment = ({ length, height, thickness, position, orientation }) => {
  const geometryArgs =
    orientation === "x"
      ? [length, height, thickness]
      : [thickness, height, length];
  const geometry = useTiledBoxGeometry(geometryArgs);

  return (
    <RigidBody
      type="fixed"
      colliders="cuboid"
      position={position}
      restitution={0}
      friction={1}
    >
      <mesh castShadow receiveShadow geometry={geometry}>
        <TileMaterial />
      </mesh>
    </RigidBody>
  );
};

/**
 * @typedef {Object} WallWithOpeningProps
 * @property {number} length
 * @property {number} height
 * @property {number} thickness
 * @property {[number, number, number]} position
 * @property {"x" | "z"} orientation
 * @property {number} openingWidth
 */

/**
 * @param {WallWithOpeningProps} props
 */
const WallWithOpening = ({
  length,
  height,
  thickness,
  position,
  orientation,
  openingWidth,
}) => {
  const cappedOpening = Math.min(Math.max(openingWidth, 0), length);
  const segmentLength = (length - cappedOpening) * 0.5;

  if (segmentLength <= 0) {
    return null;
  }

  const offset = segmentLength * 0.5 + cappedOpening * 0.5;

  if (orientation === "x") {
    return (
      <>
        <WallSegment
          length={segmentLength}
          height={height}
          thickness={thickness}
          orientation="x"
          position={[position[0] - offset, position[1], position[2]]}
        />
        <WallSegment
          length={segmentLength}
          height={height}
          thickness={thickness}
          orientation="x"
          position={[position[0] + offset, position[1], position[2]]}
        />
      </>
    );
  }

  return (
    <>
      <WallSegment
        length={segmentLength}
        height={height}
        thickness={thickness}
        orientation="z"
        position={[position[0], position[1], position[2] - offset]}
      />
      <WallSegment
        length={segmentLength}
        height={height}
        thickness={thickness}
        orientation="z"
        position={[position[0], position[1], position[2] + offset]}
      />
    </>
  );
};

/**
 * @typedef {Object} JumpTestingCirclesProps
 * @property {[number, number, number]} startPosition
 * @property {[number, number, number]} step
 * @property {number} radius
 * @property {number} count
 */

/**
 * @param {JumpTestingCirclesProps} props
 */
const JumpTestingCircles = ({ startPosition, step, radius, count }) => {
  const positions = useMemo(() => {
    const all = Array.from({ length: count }, (_, index) => {
      return [
        startPosition[0] + step[0] * index,
        startPosition[1] + step[1] * index,
        startPosition[2] + step[2] * index,
      ];
    });
    all.shift();
    return all;
  }, [count, startPosition, step]);

  return (
    <>
      {positions.map((position, index) => (
        <CircularJumpPlatform
          key={`jump-circle-${index}`}
          position={position}
          radius={radius}
        />
      ))}
    </>
  );
};

/**
 * @typedef {Object} CircularJumpPlatformProps
 * @property {[number, number, number]} position
 * @property {number} radius
 */

/**
 * @param {CircularJumpPlatformProps} props
 */
const CircularJumpPlatform = ({ position, radius }) => {
  const thickness = 0.6;
  const geometry = useTiledCylinderGeometry(radius, thickness);

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={position}
      friction={1}
      restitution={0}
    >
      <CylinderCollider
        args={[thickness * 0.5, radius]}
        friction={1}
        restitution={0}
      />
      <mesh castShadow receiveShadow geometry={geometry}>
        <TileMaterial />
      </mesh>
    </RigidBody>
  );
};

/**
 * @typedef {Object} TrampolineProps
 * @property {[number, number, number]} [position]
 * @property {number} [restitution]
 */

/**
 * @param {TrampolineProps} props
 */
const Trampoline = ({ position = [0, 0.3, 0], restitution = 2.5 }) => {
  const [x, y, z] = position;
  const legOffsets = [
    [-1.5, -1.5],
    [1.5, -1.5],
    [-1.5, 1.5],
    [1.5, 1.5],
  ];

  return (
    <group>
      <RigidBody
        type="fixed"
        colliders={false}
        position={position}
        friction={0.5}
        restitution={restitution}
      >
        <CuboidCollider
          args={[1.5, 0.15, 1.5]}
          friction={0.5}
          restitution={restitution}
        />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.3, 3]} />
          <meshStandardMaterial
            color="#00ff88"
            roughness={0.3}
            metalness={0.1}
            emissive="#00ff88"
            emissiveIntensity={0.2}
          />
        </mesh>
      </RigidBody>

      <mesh castShadow receiveShadow position={[x, y - 0.2, z]}>
        <boxGeometry args={[3.4, 0.2, 3.4]} />
        <meshStandardMaterial color="#333333" roughness={0.8} metalness={0.3} />
      </mesh>

      {legOffsets.map(([offsetX, offsetZ], index) => (
        <mesh
          key={`trampoline-leg-${index}`}
          position={[x + offsetX, y - 0.4, z + offsetZ]}
        >
          <cylinderGeometry args={[0.1, 0.15, 0.4, 8]} />
          <meshStandardMaterial
            color="#333333"
            roughness={0.8}
            metalness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
};

/**
 * @typedef {Object} LaunchPadProps
 * @property {[number, number, number]} [position]
 * @property {number} [radius]
 * @property {number} [height]
 * @property {number} [restitution]
 */

/**
 * @param {LaunchPadProps} props
 */
const LaunchPad = ({
  position = [0, 0.04, 0],
  radius = 1.5,
  height = 0.04,
  restitution = 0,
}) => {
  const halfHeight = Math.max(height * 0.5, 0.01);
  const launchVelocity = 22;
  const cooldownMs = 300;
  const lastTriggerRef = useRef(0);

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={position}
      friction={0.2}
      restitution={restitution}
    >
      <CylinderCollider
        args={[halfHeight, radius]}
        sensor
        friction={0}
        restitution={0}
        onIntersectionEnter={({ other }) => {
          const now = performance.now();
          if (now - lastTriggerRef.current < cooldownMs) return;

          const body = other.rigidBody;
          if (!body) return;

          lastTriggerRef.current = now;
          const velocity = body.linvel();
          body.setLinvel(
            { x: velocity.x, y: launchVelocity, z: velocity.z },
            true
          );
        }}
      />
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 48]} />
        <meshStandardMaterial
          color="#ff2222"
          emissive="#ff2222"
          emissiveIntensity={0.05}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
    </RigidBody>
  );
};

/**
 * @typedef {Object} ElevatorPlatformProps
 * @property {[number, number, number]} [position]
 * @property {number} [height]
 * @property {number} [climbDuration]
 * @property {number} [descentDuration]
 * @property {number} [bottomPause]
 * @property {number} [topPause]
 * @property {[number, number, number]} [size]
 */

/**
 * @param {ElevatorPlatformProps} props
 */
const ElevatorPlatform = ({
  position = [0, 0, 0],
  height = 20,
  climbDuration = 10,
  descentDuration = 10,
  bottomPause = 0,
  topPause = 0,
  size = [4, 0.5, 4],
}) => {
  const bodyRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timeRef = useRef(0);
  const lastTimeRef = useRef(null);
  const [width, thickness, depth] = size;
  const platformGeometry = useTiledBoxGeometry(size);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true
      );
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, [position]);

  useEffect(() => {
    const pauseTotal = bottomPause + topPause;
    const travelTotal = climbDuration + descentDuration;
    const totalDuration = travelTotal + pauseTotal;
    const amplitude = height / 2;
    const centerY = position[1] + amplitude;
    const bottomY = position[1];
    const topY = position[1] + height;

    const ease = (u) => (1 - Math.cos(Math.PI * u)) * 0.5;
    const easeDerivative = (u) => Math.PI * 0.5 * Math.sin(Math.PI * u);

    timeRef.current = 0;
    lastTimeRef.current = performance.now();

    const animate = () => {
      const body = bodyRef.current;
      if (body) {
        const now = performance.now();
        const last = lastTimeRef.current ?? now;
        const deltaSeconds = Math.min((now - last) / 1000, 0.05);
        lastTimeRef.current = now;

        timeRef.current = (timeRef.current + deltaSeconds) % totalDuration;

        const time = timeRef.current;
        let targetY = bottomY;
        let velocityY = 0;

        if (time < bottomPause) {
          targetY = bottomY;
          velocityY = 0;
        } else if (time < bottomPause + climbDuration) {
          const u = (time - bottomPause) / climbDuration;
          targetY = bottomY + height * ease(u);
          velocityY = (height * easeDerivative(u)) / climbDuration;
        } else if (time < bottomPause + climbDuration + topPause) {
          targetY = topY;
          velocityY = 0;
        } else {
          const u =
            (time - bottomPause - climbDuration - topPause) / descentDuration;
          targetY = topY - height * ease(u);
          velocityY = (-height * easeDerivative(u)) / descentDuration;
        }

        body.setNextKinematicTranslation({
          x: position[0],
          y: targetY,
          z: position[2],
        });
        body.setLinvel({ x: 0, y: velocityY, z: 0 }, true);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastTimeRef.current = null;
    };
  }, [climbDuration, descentDuration, bottomPause, topPause, height, position]);

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicVelocity"
      colliders={false}
      friction={1}
      restitution={0}
      ccd
      position={position}
    >
      <CuboidCollider
        args={[width / 2, thickness / 2, depth / 2]}
        friction={1}
        restitution={0}
      />
      <mesh castShadow receiveShadow geometry={platformGeometry}>
        <TileMaterial />
      </mesh>
    </RigidBody>
  );
};

/**
 * @typedef {Object} StaticPlatformProps
 * @property {[number, number, number]} position
 * @property {[number, number, number]} size
 */

/**
 * @param {StaticPlatformProps} props
 */
const StaticPlatform = ({ position, size }) => {
  const platformGeometry = useTiledBoxGeometry(size);

  return (
    <RigidBody
      type="fixed"
      colliders="cuboid"
      position={position}
      friction={1}
      restitution={0}
    >
      <mesh castShadow receiveShadow geometry={platformGeometry}>
        <TileMaterial />
      </mesh>
    </RigidBody>
  );
};

/**
 * @typedef {Object} StaircaseProps
 * @property {[number, number, number]} [position]
 * @property {[number, number, number]} [rotation]
 * @property {number} [stepWidth]
 * @property {number} [stepDepth]
 * @property {number} [totalHeight]
 * @property {number} [stepHeight]
 */

/**
 * @param {StaircaseProps} props
 */
const Staircase = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  stepWidth = 4,
  stepDepth = 2,
  totalHeight = 8,
  stepHeight = 0.2,
}) => {
  const { geometry, stepOffsets } = useMemo(() => {
    const desiredHeight = Math.max(0.5, totalHeight);
    const desiredStepHeight = Math.max(0.05, stepHeight);

    const stepCount = Math.max(
      1,
      Math.round(desiredHeight / desiredStepHeight)
    );
    const actualStepHeight = desiredHeight / stepCount;

    const sharedGeometry = createTiledBoxGeometry(
      stepWidth,
      actualStepHeight,
      stepDepth
    );

    const offsets = Array.from({ length: stepCount }, (_, index) => {
      const y = actualStepHeight * 0.5 + index * actualStepHeight;
      const z = index * stepDepth;
      return [0, y, z];
    });

    return { geometry: sharedGeometry, stepOffsets: offsets };
  }, [stepWidth, stepDepth, totalHeight, stepHeight]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <group position={position} rotation={rotation}>
      {stepOffsets.map((stepPos, index) => (
        <RigidBody
          key={`stair-step-${index}`}
          type="fixed"
          colliders="cuboid"
          position={stepPos}
          friction={1}
          restitution={0}
        >
          <mesh castShadow receiveShadow geometry={geometry}>
            <TileMaterial />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
};

export const Map18 = ({
  scale = 1,
  position = [0, 0, 0],
  characterPosition,
  characterVelocity,
  onTerrainReady,
  ...props
}) => {
  const group = useRef();
  const [physicsReady, setPhysicsReady] = useState(false);

  const { buildingGeometry, buildingPosition } = useMemo(() => {
    const width = 18 * scale;
    const height = 60 * scale;
    const depth = 14 * scale;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const tileSize = 1 / TILE_DENSITY;

    const positionAttr = geometry.attributes.position;
    const normalAttr = geometry.attributes.normal;
    const uvAttr = geometry.attributes.uv;

    const positionVector = new THREE.Vector3();
    const normalVector = new THREE.Vector3();

    for (let i = 0; i < uvAttr.count; i++) {
      positionVector.fromBufferAttribute(positionAttr, i);
      normalVector.fromBufferAttribute(normalAttr, i);

      const absNormalX = Math.abs(normalVector.x);
      const absNormalY = Math.abs(normalVector.y);
      const absNormalZ = Math.abs(normalVector.z);

      if (absNormalX >= absNormalY && absNormalX >= absNormalZ) {
        const u = (positionVector.z + depth * 0.5) / tileSize;
        const v = (positionVector.y + height * 0.5) / tileSize;
        uvAttr.setXY(i, u, v);
      } else if (absNormalY >= absNormalX && absNormalY >= absNormalZ) {
        const u = (positionVector.x + width * 0.5) / tileSize;
        const v = (positionVector.z + depth * 0.5) / tileSize;
        uvAttr.setXY(i, u, v);
      } else {
        const u = (positionVector.x + width * 0.5) / tileSize;
        const v = (positionVector.y + height * 0.5) / tileSize;
        uvAttr.setXY(i, u, v);
      }
    }

    uvAttr.needsUpdate = true;

    return {
      buildingGeometry: geometry,
      buildingPosition: [
        position[0] - 30 * scale,
        position[1] + height / 2,
        position[2] + 20, // 2.5D: Building in background (positive Z = away from camera, creating depth)
      ],
    };
  }, [scale, position]);

  useEffect(() => {
    return () => {
      buildingGeometry.dispose();
    };
  }, [buildingGeometry]);

  // Simple ground height function for flat plane
  const getGroundHeight = useMemo(
    () => (x, z) => 0, // Flat plane at y=0
    []
  );

  // Get ClaudeGrassQuick controls
  const claudeGrassQuickControls = useClaudeGrassQuickControls();
  // Get ClaudeGrassQuick2 controls
  // Leva flattens folder structure - all properties are at top level
  const claudeGrassQuick2Controls = useClaudeGrassQuick2Controls();
  // Get ClaudeGrassQuick5 controls
  const claudeGrassQuick5Controls = useClaudeGrassQuick5Controls();

  // Get Height Fog controls
  const { heightFogEnabled, fogColor, fogHeight, fogNear, fogFar } =
    useHeightFogControls();

  // Get LensFlare controls
  const {
    lensFlareEnabled,
    lensFlare1Enabled,
    lensFlare1Position,
    lensFlare1H,
    lensFlare1S,
    lensFlare1L,
    lensFlare1Intensity,
    lensFlare2Enabled,
    lensFlare2Position,
    lensFlare2H,
    lensFlare2S,
    lensFlare2L,
    lensFlare2Intensity,
    lensFlare3Enabled,
    lensFlare3Position,
    lensFlare3H,
    lensFlare3S,
    lensFlare3L,
    lensFlare3Intensity,
    flareDistance,
  } = useLensFlareControls();

  // Get Map18 controls
  const {
    skyboxEnabled,
    horizonSkyEnabled,
    horizonSkyTopColor,
    horizonSkyBottomColor,
    horizonSkyOffset,
    horizonSkyExponent,
    horizonSkyRadius,
    starsEnabled,
    starsRadius,
    starsDepth,
    starsCount,
    starsFactor,
    starsSaturation,
    starsFade,
    starsSpeed,
    nightBackgroundColor,
  } = useControls("🗺️ MAP 18", {
    skybox: folder(
      {
        skyboxEnabled: {
          value: false,
          label: "🌌 Enable Skybox",
        },
      },
      { collapsed: true }
    ),
    horizonSky: folder(
      {
        horizonSkyEnabled: {
          value: false,
          label: "🌅 Enable Horizon Sky",
        },
        horizonSkyTopColor: {
          value: "#0077ff",
          label: "🎨 Top Color",
        },
        horizonSkyBottomColor: {
          value: "#ffffff",
          label: "🎨 Bottom Color",
        },
        horizonSkyOffset: {
          value: 33,
          min: 0,
          max: 100,
          step: 1,
          label: "⬆️ Offset",
        },
        horizonSkyExponent: {
          value: 0.6,
          min: 0.1,
          max: 5,
          step: 0.1,
          label: "📈 Exponent",
        },
        horizonSkyRadius: {
          value: 4000,
          min: 500,
          max: 8000,
          step: 100,
          label: "🪐 Radius",
        },
      },
      { collapsed: true }
    ),
    nightSky: folder(
      {
        starsEnabled: {
          value: true,
          label: "✨ Enable Stars",
        },
        starsRadius: {
          value: 300,
          min: 100,
          max: 1000,
          step: 50,
          label: "⭐ Stars Radius",
        },
        starsDepth: {
          value: 50,
          min: 20,
          max: 200,
          step: 10,
          label: "🌌 Stars Depth",
        },
        starsCount: {
          value: 5000,
          min: 1000,
          max: 10000,
          step: 500,
          label: "✨ Stars Count",
        },
        starsFactor: {
          value: 4,
          min: 1,
          max: 10,
          step: 0.5,
          label: "💫 Star Size Factor",
        },
        starsSaturation: {
          value: 0,
          min: 0,
          max: 1,
          step: 0.1,
          label: "🎨 Star Saturation (0 = white)",
        },
        starsFade: {
          value: true,
          label: "🌅 Fade at Horizon",
        },
        starsSpeed: {
          value: 0.5,
          min: 0,
          max: 5,
          step: 0.1,
          label: "⚡ Rotation Speed",
        },
        nightBackgroundColor: {
          value: "#000011",
          label: "🌑 Night Background Color",
        },
      },
      { collapsed: false }
    ),
  });

  // Set scene background for night sky
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(nightBackgroundColor);
  }, [scene, nightBackgroundColor]);

  // Create stable fallback vectors
  const fallbackPosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const fallbackVelocity = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Call onTerrainReady after physics are initialized (simple maps with static geometry)
  useEffect(() => {
    if (onTerrainReady) {
      // Delay to ensure RigidBody physics are fully initialized
      const timer = setTimeout(() => {
        onTerrainReady();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [onTerrainReady]);

  // Set physicsReady after a delay (for dynamic objects like TileCube)
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPhysicsReady(true);
    }, 150);
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      setPhysicsReady(false);
    };
  }, []);

  return (
    <group ref={group} {...props}>
      <HeightFog
        enabled={heightFogEnabled}
        fogColor={fogColor}
        fogHeight={fogHeight}
        fogNear={fogNear}
        fogFar={fogFar}
      />
      {starsEnabled && (
        <Stars
          radius={starsRadius}
          depth={starsDepth}
          count={starsCount}
          factor={starsFactor}
          saturation={starsSaturation}
          fade={starsFade}
          speed={starsSpeed}
        />
      )}
      {skyboxEnabled && <Skybox />}
      {horizonSkyEnabled && (
        <HorizonSky
          topColor={horizonSkyTopColor}
          bottomColor={horizonSkyBottomColor}
          offset={horizonSkyOffset}
          exponent={horizonSkyExponent}
          radius={horizonSkyRadius}
        />
      )}

      <RigidBody type="fixed" colliders="trimesh">
        <mesh
          position={position}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={scale}
          receiveShadow
        >
          <planeGeometry args={[200, 200]} />
          <TileMaterial textureScale={TILE_REFERENCE_SCALE} />
        </mesh>
      </RigidBody>
      <RigidBody
        type="fixed"
        colliders="cuboid"
        position={buildingPosition}
        friction={1}
        restitution={0}
      >
        <mesh castShadow receiveShadow>
          <primitive object={buildingGeometry} />
          <TileMaterial textureScale={TILE_DENSITY} />
        </mesh>
      </RigidBody>

      {/* Physics cube - positioned for 2.5D */}
      {physicsReady && (
        <TileCube position={[0, 1, CHARACTER_Z]} size={[2, 2, 2]} dynamic />
      )}

      {/* Physics Debug Cubes - positioned for 2.5D */}
      <PhysicsDebugCubes
        enabled={physicsReady}
        spawnHeight={5}
        zOffset={CHARACTER_Z}
      />

      {/* 2.5D Parkour Objects - Positioned along X-axis (left/right movement) with Z-axis at CHARACTER_Z for gameplay */}
      {/* Basic parkour tiles */}
      <CylinderTile position={[-10, 0, CHARACTER_Z]} />
      <ParkourTile position={[10, 0, CHARACTER_Z]} />
      <HoleWallTile position={[-20, 0, CHARACTER_Z]} />

      {/* Elevator platforms */}
      <ElevatorPlatform
        position={[0, 0, CHARACTER_Z]}
        height={6}
        climbDuration={4}
        descentDuration={4}
        bottomPause={0.5}
        topPause={0.5}
        size={[3, 0.5, 3]}
      />
      <ElevatorPlatform
        position={[12, 6, CHARACTER_Z]}
        height={6}
        climbDuration={4}
        descentDuration={4}
        bottomPause={0.5}
        topPause={0.5}
        size={[3, 0.5, 3]}
      />
      <ElevatorPlatform
        position={[-12, 4, CHARACTER_Z]}
        height={8}
        climbDuration={5}
        descentDuration={5}
        bottomPause={0.5}
        topPause={0.5}
        size={[3.5, 0.5, 3.5]}
      />

      {/* Static platforms */}
      <StaticPlatform position={[0, 12, CHARACTER_Z]} size={[12, 1, 10]} />
      <StaticPlatform position={[8, 13, CHARACTER_Z]} size={[6, 1, 6]} />
      <StaticPlatform position={[28, 13.05, CHARACTER_Z]} size={[40, 1, 4]} />

      {/* Staircase - positioned along X-axis for 2.5D side view */}
      <Staircase
        position={[46, 0, CHARACTER_Z]}
        stepHeight={0.08}
        totalHeight={4}
        stepDepth={0.8}
        rotation={[0, Math.PI / 2, 0]} // Rotate 90 degrees for side view
      />

      {/* Jump testing circles - positioned along X-axis */}
      <JumpTestingCircles
        startPosition={[28, 13.25, CHARACTER_Z]}
        step={[4.5, 0, 0]} // Step along X-axis for 2.5D
        radius={1.6}
        count={8}
      />

      {/* Trampoline and launch pad */}
      <Trampoline position={[30, 0.3, CHARACTER_Z]} />
      <LaunchPad position={[-5, 0.03, CHARACTER_Z]} radius={1.75} />

      {/* Walls - positioned for 2.5D side view */}
      {/* Left and right walls (along Z-axis orientation) */}
      <WallSegment
        length={200}
        height={10}
        thickness={2}
        orientation="z"
        position={[-100, 5, CHARACTER_Z]}
      />
      <WallSegment
        length={200}
        height={10}
        thickness={2}
        orientation="z"
        position={[100, 5, CHARACTER_Z]}
      />
      {/* Back wall (along X-axis orientation) - for depth boundary */}
      <WallSegment
        length={200}
        height={10}
        thickness={2}
        orientation="x"
        position={[0, 5, CHARACTER_Z + 5]} // Slightly back for depth
      />

      {/* ClaudeGrassQuick - Quick_Grass port with advanced shaders */}
      {claudeGrassQuickControls.enabled && (
        <ClaudeGrassQuick
          playerPosition={
            new THREE.Vector3(
              characterPosition[0],
              characterPosition[1],
              characterPosition[2]
            )
          }
          terrainSize={claudeGrassQuickControls.terrainSize}
          heightScale={claudeGrassQuickControls.heightScale}
          heightOffset={claudeGrassQuickControls.heightOffset}
          grassWidth={claudeGrassQuickControls.grassWidth}
          grassHeight={claudeGrassQuickControls.grassHeight}
          lodDistance={claudeGrassQuickControls.lodDistance}
          maxDistance={claudeGrassQuickControls.maxDistance}
          patchSize={claudeGrassQuickControls.patchSize}
        />
      )}

      {/* ClaudeGrassQuick2 - Quick_Grass port with advanced shaders (Working Version) */}
      {claudeGrassQuick2Controls &&
        claudeGrassQuick2Controls.enabled === true && (
          <ClaudeGrassQuick2
            playerPosition={
              new THREE.Vector3(
                characterPosition[0],
                characterPosition[1],
                characterPosition[2]
              )
            }
            terrainSize={claudeGrassQuick2Controls.terrainSize}
            heightScale={claudeGrassQuick2Controls.heightScale}
            heightOffset={claudeGrassQuick2Controls.heightOffset}
            grassWidth={claudeGrassQuick2Controls.grassWidth}
            grassHeight={claudeGrassQuick2Controls.grassHeight}
            lodDistance={claudeGrassQuick2Controls.lodDistance}
            maxDistance={claudeGrassQuick2Controls.maxDistance}
            patchSize={claudeGrassQuick2Controls.patchSize}
            specularEnabled={claudeGrassQuick2Controls.specularEnabled}
            lightDirectionX={claudeGrassQuick2Controls.lightDirectionX}
            lightDirectionY={claudeGrassQuick2Controls.lightDirectionY}
            lightDirectionZ={claudeGrassQuick2Controls.lightDirectionZ}
            specularColor={claudeGrassQuick2Controls.specularColor}
            specularIntensity={claudeGrassQuick2Controls.specularIntensity}
            shininess={claudeGrassQuick2Controls.shininess}
          />
        )}

      {/* ClaudeGrassQuick5 - Quick_Grass port (New working version) */}
      {claudeGrassQuick5Controls.enabled && (
        <ClaudeGrassQuick5
          playerPosition={characterPosition || [0, 0, 0]}
          terrainSize={claudeGrassQuick5Controls.terrainSize}
          heightScale={claudeGrassQuick5Controls.heightScale}
          heightOffset={claudeGrassQuick5Controls.heightOffset}
          grassWidth={claudeGrassQuick5Controls.grassWidth}
          grassHeight={claudeGrassQuick5Controls.grassHeight}
          grassDensity={claudeGrassQuick5Controls.grassDensity}
          lodDistance={claudeGrassQuick5Controls.lodDistance}
          maxDistance={claudeGrassQuick5Controls.maxDistance}
          patchSize={claudeGrassQuick5Controls.patchSize}
          gridSize={claudeGrassQuick5Controls.gridSize}
          patchSpacing={claudeGrassQuick5Controls.patchSpacing}
          windEnabled={claudeGrassQuick5Controls.windEnabled}
          windStrength={claudeGrassQuick5Controls.windStrength}
          windDirectionScale={claudeGrassQuick5Controls.windDirectionScale}
          windDirectionSpeed={claudeGrassQuick5Controls.windDirectionSpeed}
          windStrengthScale={claudeGrassQuick5Controls.windStrengthScale}
          windStrengthSpeed={claudeGrassQuick5Controls.windStrengthSpeed}
          playerInteractionEnabled={
            claudeGrassQuick5Controls.playerInteractionEnabled
          }
          playerInteractionRepel={
            claudeGrassQuick5Controls.playerInteractionRepel
          }
          playerInteractionRange={
            claudeGrassQuick5Controls.playerInteractionRange
          }
          playerInteractionStrength={
            claudeGrassQuick5Controls.playerInteractionStrength
          }
          playerInteractionHeightThreshold={
            claudeGrassQuick5Controls.playerInteractionHeightThreshold
          }
          baseColor1={claudeGrassQuick5Controls.baseColor1}
          baseColor2={claudeGrassQuick5Controls.baseColor2}
          tipColor1={claudeGrassQuick5Controls.tipColor1}
          tipColor2={claudeGrassQuick5Controls.tipColor2}
          gradientCurve={claudeGrassQuick5Controls.gradientCurve}
          aoEnabled={claudeGrassQuick5Controls.aoEnabled}
          aoIntensity={claudeGrassQuick5Controls.aoIntensity}
          fogEnabled={claudeGrassQuick5Controls.fogEnabled}
          fogNear={claudeGrassQuick5Controls.fogNear}
          fogFar={claudeGrassQuick5Controls.fogFar}
          fogIntensity={claudeGrassQuick5Controls.fogIntensity}
          fogColor={claudeGrassQuick5Controls.fogColor}
          specularEnabled={claudeGrassQuick5Controls.specularEnabled}
          specularIntensity={claudeGrassQuick5Controls.specularIntensity}
          specularColor={claudeGrassQuick5Controls.specularColor}
          specularDirectionX={claudeGrassQuick5Controls.specularDirectionX}
          specularDirectionY={claudeGrassQuick5Controls.specularDirectionY}
          specularDirectionZ={claudeGrassQuick5Controls.specularDirectionZ}
          grassMiddleBrightnessMin={
            claudeGrassQuick5Controls.grassMiddleBrightnessMin
          }
          grassMiddleBrightnessMax={
            claudeGrassQuick5Controls.grassMiddleBrightnessMax
          }
          backscatterEnabled={claudeGrassQuick5Controls.backscatterEnabled}
          backscatterIntensity={claudeGrassQuick5Controls.backscatterIntensity}
          backscatterColor={claudeGrassQuick5Controls.backscatterColor}
          backscatterPower={claudeGrassQuick5Controls.backscatterPower}
          frontScatterStrength={claudeGrassQuick5Controls.frontScatterStrength}
          rimSSSStrength={claudeGrassQuick5Controls.rimSSSStrength}
        />
      )}

      {/* Lens Flares */}
      {lensFlareEnabled && (
        <>
          {lensFlare1Enabled && (
            <LensFlare
              position={[
                lensFlare1Position.x,
                lensFlare1Position.y,
                lensFlare1Position.z,
              ]}
              h={lensFlare1H}
              s={lensFlare1S}
              l={lensFlare1L}
              intensity={lensFlare1Intensity}
              distance={flareDistance}
            />
          )}
          {lensFlare2Enabled && (
            <LensFlare
              position={[
                lensFlare2Position.x,
                lensFlare2Position.y,
                lensFlare2Position.z,
              ]}
              h={lensFlare2H}
              s={lensFlare2S}
              l={lensFlare2L}
              intensity={lensFlare2Intensity}
              distance={flareDistance}
            />
          )}
          {lensFlare3Enabled && (
            <LensFlare
              position={[
                lensFlare3Position.x,
                lensFlare3Position.y,
                lensFlare3Position.z,
              ]}
              h={lensFlare3H}
              s={lensFlare3S}
              l={lensFlare3L}
              intensity={lensFlare3Intensity}
              distance={flareDistance}
            />
          )}
        </>
      )}
    </group>
  );
};
