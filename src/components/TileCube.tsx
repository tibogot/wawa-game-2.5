import React, { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { TileMaterial } from "./TileMaterial";
import { TILE_DENSITY } from "./tileMaterialConfig";
import { CuboidCollider, RigidBody } from "@react-three/rapier";

type TileCubeProps = {
  size?: [number, number, number];
  textureScale?: number;
  dynamic?: boolean;
  position?: [number, number, number];
} & Omit<React.ComponentProps<"mesh">, "position">;

export const TileCube = forwardRef<THREE.Mesh | null, TileCubeProps>(
  (
    {
      size = [2, 2, 2],
      textureScale,
      dynamic = false,
      position = [0, 0, 0],
      ...props
    }: TileCubeProps,
    ref
  ) => {
    const derivedScale = useMemo(() => {
      if (typeof textureScale === "number") {
        return textureScale;
      }

      const width = Array.isArray(size) ? Math.abs(size[0]) : 1;
      const depth = Array.isArray(size) ? Math.abs(size[2]) : width;
      const representativeSpan = Math.max(width, depth);

      return representativeSpan * TILE_DENSITY;
    }, [size, textureScale]);

    const cube = (
      <mesh ref={ref} castShadow receiveShadow {...props}>
        <boxGeometry args={size} />
        <TileMaterial textureScale={derivedScale} />
      </mesh>
    );

    if (!dynamic) {
      return cube;
    }

    const halfX = size[0] / 2;
    const halfY = size[1] / 2;
    const halfZ = size[2] / 2;

    return (
      <RigidBody
        type="dynamic"
        position={position}
        enabledRotations={[false, false, false]}
        angularDamping={2}
        linearDamping={0.5}
        mass={10}
        friction={0.9}
        restitution={0}
      >
        <CuboidCollider args={[halfX, halfY, halfZ]} />
        {cube}
      </RigidBody>
    );
  }
);

TileCube.displayName = "TileCube";
