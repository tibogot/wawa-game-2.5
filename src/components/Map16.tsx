import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { TileMaterial } from "./TileMaterial";
import {
  TILE_DENSITY,
  TILE_REFERENCE_SCALE,
  TILE_REFERENCE_SIZE,
} from "./tileMaterialConfig";
import { TeleportationRequest } from "../types/teleportation";

type Map16Props = {
  scale?: number;
  position?: [number, number, number];
  onTerrainReady?: (terrain: THREE.Mesh | null) => void;
  onTeleportRequest?: (request: TeleportationRequest) => void;
} & React.ComponentProps<"group">;

export const Map16 = forwardRef<THREE.Mesh | null, Map16Props>(
  (
    {
      scale = 1,
      position = [0, 0, 0],
      onTerrainReady,
      onTeleportRequest,
      ...props
    }: Map16Props,
    ref
  ) => {
    const floorRef = useRef<THREE.Mesh | null>(null);

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
    }, [onTerrainReady]);

    const buildings = useMemo(
      () =>
        [
          { size: [18, 60, 14], position: [-30, 30, -20] },
          { size: [22, 75, 22], position: [25, 37.5, -25] },
          { size: [12, 45, 28], position: [-10, 22.5, 30] },
          { size: [28, 80, 18], position: [35, 40, 18] },
          { size: [16, 55, 16], position: [0, 27.5, -40] },
          { size: [14, 65, 24], position: [-45, 32.5, 20] },
          { size: [20, 90, 20], position: [10, 45, 42] },
        ] satisfies BuildingConfig[],
      []
    );

    const teleportDoors = useMemo<TeleportDoorConfig[]>(
      () => [
        {
          id: "map16-door-a",
          position: [-52, 0, 44],
          targetId: "map16-door-b",
          activationRadius: 1.8,
          activationHeight: 0.35,
          cameraOffset: [0, 5, 8],
          lookAtOffset: [0, 2.2, 0],
          spawnOffset: [0, 1.4, 0],
          delayMs: 200,
          cooldownMs: 1200,
          frameHeight: 4.2,
          frameWidth: 2.6,
          frameDepth: 0.35,
          frameColor: "#3bd2ff",
        },
        {
          id: "map16-door-b",
          position: [52, 0, -44],
          targetId: "map16-door-a",
          activationRadius: 1.8,
          activationHeight: 0.35,
          cameraOffset: [0, 5, -8],
          lookAtOffset: [0, 2.2, 0],
          spawnOffset: [0, 1.4, 0],
          delayMs: 200,
          cooldownMs: 1200,
          frameHeight: 4.2,
          frameWidth: 2.6,
          frameDepth: 0.35,
          frameColor: "#ff8cf7",
        },
      ],
      []
    );

    const teleportDoorLookup = useMemo(() => {
      const lookup = new Map<string, TeleportDoorConfig>();
      teleportDoors.forEach((door) => lookup.set(door.id, door));
      return lookup;
    }, [teleportDoors]);

    const buildingGeometries = useMemo(() => {
      const tileSize = 1 / TILE_DENSITY;

      return buildings.map(({ size }) => {
        const width = size[0] * scale;
        const height = size[1] * scale;
        const depth = size[2] * scale;
        const geometry = new THREE.BoxGeometry(width, height, depth);

        const positionAttr = geometry.attributes
          .position as THREE.BufferAttribute;
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
        return geometry;
      });
    }, [buildings, scale]);

    useEffect(() => {
      return () => {
        buildingGeometries.forEach((geometry) => geometry.dispose());
      };
    }, [buildingGeometries]);

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
        {buildings.map(({ position: buildingPosition }, index) => {
          const worldPosition: [number, number, number] = [
            position[0] + buildingPosition[0] * scale,
            position[1] + buildingPosition[1] * scale,
            position[2] + buildingPosition[2] * scale,
          ];

          return (
            <RigidBody
              key={index}
              type="fixed"
              colliders="cuboid"
              position={worldPosition}
              friction={1}
              restitution={0}
            >
              <mesh castShadow receiveShadow>
                <primitive object={buildingGeometries[index]} />
                <TileMaterial textureScale={TILE_DENSITY} />
              </mesh>
            </RigidBody>
          );
        })}
        {teleportDoors.map((door) => {
          const targetDoor = teleportDoorLookup.get(door.targetId);
          if (!targetDoor) {
            return null;
          }
          return (
            <TeleportationDoor
              key={door.id}
              door={door}
              targetDoor={targetDoor}
              mapScale={scale}
              mapPosition={position}
              onTeleportRequest={onTeleportRequest}
            />
          );
        })}
      </group>
    );
  }
);

Map16.displayName = "Map16";

type BuildingConfig = {
  size: [number, number, number];
  position: [number, number, number];
};

type TeleportDoorConfig = {
  id: string;
  position: [number, number, number];
  targetId: string;
  activationRadius?: number;
  activationHeight?: number;
  cameraOffset?: [number, number, number];
  lookAtOffset?: [number, number, number];
  spawnOffset?: [number, number, number];
  delayMs?: number;
  cooldownMs?: number;
  frameHeight?: number;
  frameWidth?: number;
  frameDepth?: number;
  frameColor?: string;
};

type TeleportationDoorProps = {
  door: TeleportDoorConfig;
  targetDoor: TeleportDoorConfig;
  mapScale: number;
  mapPosition: [number, number, number];
  onTeleportRequest?: (request: TeleportationRequest) => void;
};

const teleportDoorCooldownRegistry = new Map<string, Map<number, number>>();

const TeleportationDoor = ({
  door,
  targetDoor,
  mapScale,
  mapPosition,
  onTeleportRequest,
}: TeleportationDoorProps) => {
  const cooldownMap = useMemo(() => {
    let existing = teleportDoorCooldownRegistry.get(door.id);
    if (!existing) {
      existing = new Map<number, number>();
      teleportDoorCooldownRegistry.set(door.id, existing);
    }
    return existing;
  }, [door.id]);

  const originWorld = useMemo(
    () =>
      new THREE.Vector3(
        mapPosition[0] + door.position[0] * mapScale,
        mapPosition[1] + door.position[1] * mapScale,
        mapPosition[2] + door.position[2] * mapScale
      ),
    [door.position, mapPosition, mapScale]
  );

  const targetWorld = useMemo(
    () =>
      new THREE.Vector3(
        mapPosition[0] + targetDoor.position[0] * mapScale,
        mapPosition[1] + targetDoor.position[1] * mapScale,
        mapPosition[2] + targetDoor.position[2] * mapScale
      ),
    [targetDoor.position, mapPosition, mapScale]
  );

  const activationRadius = (door.activationRadius ?? 1.5) * mapScale;
  const activationHeight = (door.activationHeight ?? 0.3) * mapScale;
  const halfHeight = Math.max(activationHeight * 0.5, 0.05);

  const frameHeight = (door.frameHeight ?? 4) * mapScale;
  const frameWidth = (door.frameWidth ?? 2) * mapScale;
  const frameDepth = (door.frameDepth ?? 0.25) * mapScale;
  const frameColor = door.frameColor ?? "#3bd2ff";
  const frameThickness = frameDepth * 0.6;

  const scaledSpawnOffset =
    door.spawnOffset !== undefined
      ? (door.spawnOffset.map((value) => value * mapScale) as [
          number,
          number,
          number,
        ])
      : [0, 1.2 * mapScale, 0];
  const scaledCameraOffset =
    door.cameraOffset !== undefined
      ? (door.cameraOffset.map((value) => value * mapScale) as [
          number,
          number,
          number,
        ])
      : [0, 5 * mapScale, 8 * mapScale];
  const scaledLookAtOffset =
    door.lookAtOffset !== undefined
      ? (door.lookAtOffset.map((value) => value * mapScale) as [
          number,
          number,
          number,
        ])
      : [0, 2 * mapScale, 0];

  const delayMs = door.delayMs ?? 200;
  const cooldownMs = door.cooldownMs ?? 1000;
  const originPosition: [number, number, number] = [
    originWorld.x,
    originWorld.y,
    originWorld.z,
  ];

  const targetPosition: [number, number, number] = [
    targetWorld.x,
    targetWorld.y,
    targetWorld.z,
  ];

  const spawnPosition: [number, number, number] = [
    targetWorld.x + scaledSpawnOffset[0],
    targetWorld.y + scaledSpawnOffset[1],
    targetWorld.z + scaledSpawnOffset[2],
  ];

  const cameraPosition: [number, number, number] = [
    targetWorld.x + scaledCameraOffset[0],
    targetWorld.y + scaledCameraOffset[1],
    targetWorld.z + scaledCameraOffset[2],
  ];

  const lookAtPosition: [number, number, number] = [
    targetWorld.x + scaledLookAtOffset[0],
    targetWorld.y + scaledLookAtOffset[1],
    targetWorld.z + scaledLookAtOffset[2],
  ];

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={originPosition}
      friction={0}
      restitution={0}
    >
      <CylinderCollider
        args={[halfHeight, activationRadius]}
        sensor
        onIntersectionEnter={({ other }) => {
          const body = other.rigidBody;
          if (!body || !onTeleportRequest) {
            return;
          }

          const handle = body.handle;
          const now = performance.now();
          const last = cooldownMap.get(handle);
          if (last !== undefined && now - last < cooldownMs) {
            return;
          }

          cooldownMap.set(handle, now);
          let targetCooldown = teleportDoorCooldownRegistry.get(targetDoor.id);
          if (!targetCooldown) {
            targetCooldown = new Map<number, number>();
            teleportDoorCooldownRegistry.set(targetDoor.id, targetCooldown);
          }
          targetCooldown.set(handle, now);

          const request: TeleportationRequest = {
            id: `${door.id}-${Date.now()}`,
            sourceId: door.id,
            targetId: targetDoor.id,
            targetPosition,
            spawnPosition,
            cameraPosition,
            lookAtPosition,
            delayMs,
          };

          onTeleportRequest(request);
        }}
      />
      <group>
        <mesh
          castShadow
          receiveShadow
          position={[0, -halfHeight - 0.05 * mapScale, 0]}
        >
          <cylinderGeometry
            args={[
              activationRadius * 1.05,
              activationRadius * 1.2,
              0.1 * mapScale,
              32,
            ]}
          />
          <meshStandardMaterial
            color="#1a1a1f"
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>

        <group>
          <mesh
            castShadow
            receiveShadow
            position={[
              -frameWidth * 0.5 + frameThickness * 0.5,
              frameHeight * 0.5,
              0,
            ]}
          >
            <boxGeometry args={[frameThickness, frameHeight, frameDepth]} />
            <meshStandardMaterial
              color={frameColor}
              emissive={frameColor}
              emissiveIntensity={0.35}
              roughness={0.25}
              metalness={0.6}
            />
          </mesh>
          <mesh
            castShadow
            receiveShadow
            position={[
              frameWidth * 0.5 - frameThickness * 0.5,
              frameHeight * 0.5,
              0,
            ]}
          >
            <boxGeometry args={[frameThickness, frameHeight, frameDepth]} />
            <meshStandardMaterial
              color={frameColor}
              emissive={frameColor}
              emissiveIntensity={0.35}
              roughness={0.25}
              metalness={0.6}
            />
          </mesh>
          <mesh
            castShadow
            receiveShadow
            position={[0, frameHeight - frameThickness * 0.5, 0]}
          >
            <boxGeometry
              args={[frameWidth - frameThickness, frameThickness, frameDepth]}
            />
            <meshStandardMaterial
              color={frameColor}
              emissive={frameColor}
              emissiveIntensity={0.35}
              roughness={0.25}
              metalness={0.6}
            />
          </mesh>
          <mesh position={[0, frameHeight * 0.5, 0]} castShadow receiveShadow>
            <planeGeometry args={[frameWidth * 0.7, frameHeight * 0.9]} />
            <meshStandardMaterial
              color={frameColor}
              emissive={frameColor}
              emissiveIntensity={0.6}
              transparent
              opacity={0.45}
              roughness={0.15}
              metalness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        <mesh
          position={[0, frameHeight * 0.1, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry
            args={[activationRadius * 0.65, frameThickness * 0.35, 16, 48]}
          />
          <meshStandardMaterial
            color={frameColor}
            emissive={frameColor}
            emissiveIntensity={0.5}
            roughness={0.2}
            metalness={0.3}
          />
        </mesh>
      </group>
    </RigidBody>
  );
};
