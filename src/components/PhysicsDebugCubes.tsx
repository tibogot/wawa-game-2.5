import React from "react";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";

interface PhysicsDebugCubesProps {
  enabled?: boolean;
  spawnHeight?: number; // Y position to spawn cubes at (should be high above terrain)
}

export const PhysicsDebugCubes: React.FC<PhysicsDebugCubesProps> = ({
  enabled = false,
  spawnHeight = 20,
}) => {
  if (!enabled) return null;

  return (
    <group>
      {/* ========== PHYSICS CUBES - KEEP ORIGINAL COLORS ========== */}

      {/* LIGHT CUBE 1 - Very easy to push (Green) - Mass: 1kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-5, spawnHeight, 0]}
        mass={1}
        friction={0.5}
        restitution={0.1}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#00ff00"
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      </RigidBody>

      {/* LIGHT CUBE 2 - Very easy to push (Lime) - Mass: 1kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-3, spawnHeight, 0]}
        mass={1}
        friction={0.5}
        restitution={0.1}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#7fff00"
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      </RigidBody>

      {/* MEDIUM CUBE 1 - Moderate (Yellow) - Mass: 5kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[3, spawnHeight, 0]}
        mass={5}
        friction={0.5}
        restitution={0.1}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#ffff00"
            roughness={0.7}
            metalness={0.3}
          />
        </mesh>
      </RigidBody>

      {/* MEDIUM CUBE 2 - Moderate (Orange) - Mass: 5kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[5, spawnHeight, 0]}
        mass={5}
        friction={0.5}
        restitution={0.1}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#ffa500"
            roughness={0.7}
            metalness={0.3}
          />
        </mesh>
      </RigidBody>

      {/* HEAVY CUBE 1 - Hard to push (Red) - Mass: 15kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-5, spawnHeight, 3]}
        mass={15}
        friction={0.6}
        restitution={0.05}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#ff0000"
            roughness={0.8}
            metalness={0.4}
          />
        </mesh>
      </RigidBody>

      {/* HEAVY CUBE 2 - Hard to push (Dark Red) - Mass: 15kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-3, spawnHeight, 3]}
        mass={15}
        friction={0.6}
        restitution={0.05}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#8b0000"
            roughness={0.8}
            metalness={0.4}
          />
        </mesh>
      </RigidBody>

      {/* VERY HEAVY CUBE - Very hard to push (Purple) - Mass: 30kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[0, spawnHeight, 3]}
        mass={30}
        friction={0.7}
        restitution={0}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#8b008b"
            roughness={0.9}
            metalness={0.5}
          />
        </mesh>
      </RigidBody>

      {/* SUPER LIGHT CUBE - Flies away easily (Cyan) - Mass: 0.5kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[3, spawnHeight, 3]}
        mass={0.5}
        friction={0.3}
        restitution={0.3}
        linearDamping={0.3}
        angularDamping={0.3}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#00ffff"
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* STACK OF LIGHT CUBES - Fun to knock over - Mass: 2kg each */}
      {[0, 1, 2].map((i) => (
        <RigidBody
          key={`stack-${i}`}
          type="dynamic"
          colliders="cuboid"
          position={[5, spawnHeight + i * 1.05, 3]}
          mass={2}
          friction={0.5}
          restitution={0.1}
          linearDamping={0.5}
          angularDamping={0.5}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={i === 0 ? "#90ee90" : i === 1 ? "#98fb98" : "#adff2f"}
              roughness={0.7}
              metalness={0.2}
            />
          </mesh>
        </RigidBody>
      ))}

      {/* LARGE HEAVY BOX - Like a crate (Brown) - Mass: 50kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-7, spawnHeight + 0.25, 6]}
        mass={50}
        friction={0.8}
        restitution={0}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial
            color="#8b4513"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* TINY LIGHT CUBE - Kicks far (White) - Mass: 0.2kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[7, spawnHeight - 0.25, 2]}
        mass={0.2}
        friction={0.2}
        restitution={0.5}
        linearDamping={0.2}
        angularDamping={0.2}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* DEBUG TEST CUBE - Heavy, no rotation (Black) - Mass: 40kg - For testing jump hang issue */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[0, spawnHeight, -3]}
        mass={40}
        friction={0.5}
        restitution={0}
        lockRotations
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#000000"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>
    </group>
  );
};

export default PhysicsDebugCubes;
