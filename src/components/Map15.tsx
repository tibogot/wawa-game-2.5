import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useControls } from "leva";
import { useGLTF } from "@react-three/drei";
import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { TileMaterial } from "./TileMaterial";
import { TileCube } from "./TileCube";
import {
  TILE_DENSITY,
  TILE_REFERENCE_SCALE,
  TILE_REFERENCE_SIZE,
} from "./tileMaterialConfig";
import { PhysicsDebugCubes } from "./PhysicsDebugCubes";

const TILE_WORLD_UNIT = 1 / TILE_DENSITY;

const createTiledBoxGeometry = (
  width: number,
  height: number,
  depth: number
) => {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
  const normalAttr = geometry.attributes.normal as THREE.BufferAttribute;
  const uvAttr = geometry.attributes.uv as THREE.BufferAttribute;

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

const useTiledBoxGeometry = (size: [number, number, number]) => {
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

const createTiledCylinderGeometry = (
  radius: number,
  height: number,
  radialSegments = 48
) => {
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    radialSegments,
    1,
    false
  );

  const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
  const normalAttr = geometry.attributes.normal as THREE.BufferAttribute;
  const uvAttr = geometry.attributes.uv as THREE.BufferAttribute;

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

const useTiledCylinderGeometry = (
  radius: number,
  height: number,
  radialSegments = 48
) => {
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

type Map15Props = {
  scale?: number;
  position?: [number, number, number];
  onTerrainReady?: (terrain: THREE.Mesh | null) => void;
} & React.ComponentProps<"group">;

export const Map15 = forwardRef<THREE.Mesh | null, Map15Props>(
  (
    { scale = 1, position = [0, 0, 0], onTerrainReady, ...props }: Map15Props,
    ref
  ) => {
    const floorRef = useRef<THREE.Mesh | null>(null);
    const [physicsReady, setPhysicsReady] = useState(false);
    const assignRefs = useCallback(
      (value: THREE.Mesh | null) => {
        floorRef.current = value;
        if (typeof ref === "function") {
          ref(value);
        } else if (ref) {
          ref.current = value;
        }
      },
      [ref]
    );

    useEffect(() => {
      if (onTerrainReady) {
        onTerrainReady(floorRef.current);
      }
      let timeoutId: number | null = window.setTimeout(() => {
        setPhysicsReady(true);
      }, 150);
      return () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        setPhysicsReady(false);
      };
    }, [onTerrainReady]);

    return (
      <group {...props}>
        <RigidBody
          type="fixed"
          colliders="trimesh"
          position={position}
          restitution={0}
          friction={1}
        >
          <mesh
            ref={assignRefs}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={scale}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[TILE_REFERENCE_SIZE, TILE_REFERENCE_SIZE]} />
            <TileMaterial textureScale={TILE_REFERENCE_SCALE} />
          </mesh>
        </RigidBody>
        {physicsReady && (
          <TileCube position={[0, 1, -5]} size={[2, 2, 2]} dynamic />
        )}
        <PhysicsDebugCubes enabled={physicsReady} spawnHeight={5} />
        <CylinderTile position={[-10, 0, 10]} />
        <ParkourTile position={[10, 0, -10]} />
        <HoleWallTile position={[-20, 0, -20]} />
        <ElevatorPlatform position={[0, 0, 15]} />
        <StaticPlatform position={[0, 12, 24]} size={[12, 1, 10]} />
        <StaticPlatform position={[8, 13, 24]} size={[6, 1, 6]} />
        <StaticPlatform position={[28, 13.05, 24]} size={[40, 1, 4]} />
        <Staircase
          position={[46, 0, 35]}
          stepHeight={0.08}
          totalHeight={4}
          stepDepth={0.8}
          rotation={[0, Math.PI, 0]}
        />
        <JumpTestingCircles
          startPosition={[28, 13.25, 24]}
          step={[0, 0, 4.5]}
          radius={1.6}
          count={8}
        />
        <ElevatorPlatform
          position={[12, 6, 18]}
          height={6}
          climbDuration={4}
          descentDuration={4}
          bottomPause={0.5}
          topPause={0.5}
          size={[3, 0.5, 3]}
        />
        <ElevatorPlatform
          position={[-12, 4, 22]}
          height={8}
          climbDuration={5}
          descentDuration={5}
          bottomPause={0.5}
          topPause={0.5}
          size={[3.5, 0.5, 3.5]}
        />
        <WallSegment
          length={100}
          height={10}
          thickness={2}
          orientation="x"
          position={[0, 5, 51]}
        />
        <WallWithOpening
          length={100}
          height={10}
          thickness={2}
          orientation="x"
          position={[0, 5, -51]}
          openingWidth={8}
        />
        <WallSegment
          length={100}
          height={10}
          thickness={2}
          orientation="z"
          position={[51, 5, 0]}
        />
        <WallSegment
          length={100}
          height={10}
          thickness={2}
          orientation="z"
          position={[-51, 5, 0]}
        />
        <Trampoline position={[30, 0.3, -20]} />
        <LaunchPad position={[-5, 0.03, 30]} radius={1.75} />
      </group>
    );
  }
);

Map15.displayName = "Map15";

type ExtractedMesh = {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  textureScale: number;
};

const CYLINDER_PATH = "/models/parkour/cylinder.glb";
const PARKOUR_PATH = "/models/parkour/parkour1.glb";
const HOLEWALL_PATH = "/models/parkour/holewall.glb";
useGLTF.preload(CYLINDER_PATH);
useGLTF.preload(PARKOUR_PATH);
useGLTF.preload(HOLEWALL_PATH);

type SharedTileProps = {
  position?: [number, number, number];
  textureScale?: number;
};

const createMeshEntries = (
  scene: THREE.Group,
  adjustGeometry?: (
    geometry: THREE.BufferGeometry,
    meshScale: THREE.Vector3
  ) => void
) => {
  const results: ExtractedMesh[] = [];
  scene.updateMatrixWorld(true);

  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
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

const CylinderTile = ({ position = [0, 0, 0] }: SharedTileProps) => {
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

const ParkourTile = ({ position = [0, 0, 0] }: SharedTileProps) => {
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

const HoleWallTile = ({ position = [0, 0, 0] }: SharedTileProps) => {
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

type WallSegmentProps = {
  length: number;
  height: number;
  thickness: number;
  position: [number, number, number];
  orientation: "x" | "z";
};

const WallSegment = ({
  length,
  height,
  thickness,
  position,
  orientation,
}: WallSegmentProps) => {
  const geometryArgs: [number, number, number] =
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

type WallWithOpeningProps = WallSegmentProps & {
  openingWidth: number;
};

const WallWithOpening = ({
  length,
  height,
  thickness,
  position,
  orientation,
  openingWidth,
}: WallWithOpeningProps) => {
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

type JumpTestingCirclesProps = {
  startPosition: [number, number, number];
  step: [number, number, number];
  radius: number;
  count: number;
};

const JumpTestingCircles = ({
  startPosition,
  step,
  radius,
  count,
}: JumpTestingCirclesProps) => {
  const positions = useMemo(() => {
    const all = Array.from({ length: count }, (_, index) => {
      return [
        startPosition[0] + step[0] * index,
        startPosition[1] + step[1] * index,
        startPosition[2] + step[2] * index,
      ] as [number, number, number];
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

type CircularJumpPlatformProps = {
  position: [number, number, number];
  radius: number;
};

const CircularJumpPlatform = ({
  position,
  radius,
}: CircularJumpPlatformProps) => {
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

type TrampolineProps = {
  position?: [number, number, number];
  restitution?: number;
};

const Trampoline = ({
  position = [0, 0.3, 0],
  restitution = 2.5,
}: TrampolineProps) => {
  const [x, y, z] = position;
  const legOffsets: Array<[number, number]> = [
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

type LaunchPadProps = {
  position?: [number, number, number];
  radius?: number;
  height?: number;
  restitution?: number;
};

const LaunchPad = ({
  position = [0, 0.04, 0],
  radius = 1.5,
  height = 0.04,
  restitution = 0,
}: LaunchPadProps) => {
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

type ElevatorPlatformProps = {
  position?: [number, number, number];
  height?: number;
  climbDuration?: number;
  descentDuration?: number;
  bottomPause?: number;
  topPause?: number;
  size?: [number, number, number];
};

const ElevatorPlatform = ({
  position = [0, 0, 0],
  height = 20,
  climbDuration = 10,
  descentDuration = 10,
  bottomPause = 0,
  topPause = 0,
  size = [4, 0.5, 4],
}: ElevatorPlatformProps) => {
  const bodyRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
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

    const ease = (u: number) => (1 - Math.cos(Math.PI * u)) * 0.5;
    const easeDerivative = (u: number) => Math.PI * 0.5 * Math.sin(Math.PI * u);

    // Start at the bottom of the cycle
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

type StaticPlatformProps = {
  position: [number, number, number];
  size: [number, number, number];
};

const StaticPlatform = ({ position, size }: StaticPlatformProps) => {
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

type StaircaseProps = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  stepWidth?: number;
  stepDepth?: number;
  totalHeight?: number;
  stepHeight?: number;
};

const Staircase = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  stepWidth = 4,
  stepDepth = 2,
  totalHeight = 8,
  stepHeight = 0.2,
}: StaircaseProps) => {
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
      return [0, y, z] as [number, number, number];
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
