import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { bvhManager } from "../utils/bvhManager";

/**
 * Hook to register static meshes with BVH manager for character collision detection
 * Use this in map components to register terrain, buildings, and static platforms
 */
export const useBVHRegistration = (
  meshes: (THREE.Mesh | null | undefined)[],
  enabled: boolean = true
) => {
  const { scene } = useThree();
  const registeredRef = useRef<Set<THREE.Mesh>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    // Build BVH for all valid meshes
    meshes.forEach((mesh) => {
      if (mesh && mesh instanceof THREE.Mesh && !registeredRef.current.has(mesh)) {
        const bvhMesh = bvhManager.buildBVH(mesh);
        if (bvhMesh) {
          registeredRef.current.add(mesh);
        }
      }
    });

    // Update matrices periodically (when meshes transform)
    const interval = setInterval(() => {
      bvhManager.updateMatrices();
    }, 100); // Update every 100ms

    return () => {
      clearInterval(interval);
      // Cleanup: remove BVH for meshes that are no longer in the list
      registeredRef.current.forEach((mesh) => {
        if (!meshes.includes(mesh)) {
          bvhManager.removeBVH(mesh);
          registeredRef.current.delete(mesh);
        }
      });
    };
  }, [meshes, enabled, scene]);
};

/**
 * Hook to register a single mesh with BVH manager
 */
export const useBVHSingleMesh = (
  mesh: THREE.Mesh | null | undefined,
  enabled: boolean = true
) => {
  useBVHRegistration([mesh], enabled);
};

