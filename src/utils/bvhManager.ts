import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";

/**
 * BVH Manager for character collision detection
 * Builds and manages BVH for static meshes (terrain, buildings, platforms)
 */

// Extend Mesh prototype with accelerated raycast
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export interface BVHMesh {
  mesh: THREE.Mesh;
  bvh: MeshBVH;
  invMatrixWorld: THREE.Matrix4;
}

class BVHManager {
  private bvhMeshes: Map<THREE.Mesh, BVHMesh> = new Map();
  private raycaster: THREE.Raycaster;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true; // Optimize for first hit only
  }

  /**
   * Build BVH for a static mesh (terrain, buildings, platforms)
   * Call this when meshes are added to the scene
   */
  buildBVH(mesh: THREE.Mesh): BVHMesh | null {
    if (!mesh.geometry) {
      console.warn("BVHManager: Mesh has no geometry", mesh);
      return null;
    }

    // Skip if already has BVH
    if (this.bvhMeshes.has(mesh)) {
      return this.bvhMeshes.get(mesh)!;
    }

    try {
      // Ensure geometry has index
      if (!mesh.geometry.index) {
        mesh.geometry = mesh.geometry.toNonIndexed();
      }

      // Build BVH
      // Note: Strategy options: CENTER (default), AVERAGE, SAH (Surface Area Heuristic)
      // Using CENTER as default - it's faster to build and works well for most cases
      const bvh = new MeshBVH(mesh.geometry, {
        maxDepth: 40,
        maxLeafTris: 10,
        // strategy: CENTER, // Optional - CENTER is the default
      });

      // Store inverse matrix for world-to-local transforms
      const invMatrixWorld = new THREE.Matrix4();

      const bvhMesh: BVHMesh = {
        mesh,
        bvh,
        invMatrixWorld,
      };

      this.bvhMeshes.set(mesh, bvhMesh);

      // Update inverse matrix when mesh transforms
      mesh.updateMatrixWorld(true);
      invMatrixWorld.copy(mesh.matrixWorld).invert();

      return bvhMesh;
    } catch (error) {
      console.error("BVHManager: Failed to build BVH", error, mesh);
      return null;
    }
  }

  /**
   * Remove BVH for a mesh (cleanup)
   */
  removeBVH(mesh: THREE.Mesh): void {
    this.bvhMeshes.delete(mesh);
  }

  /**
   * Update inverse matrices for all BVH meshes
   * Call this when meshes are transformed
   */
  updateMatrices(): void {
    this.bvhMeshes.forEach((bvhMesh) => {
      bvhMesh.mesh.updateMatrixWorld(true);
      bvhMesh.invMatrixWorld.copy(bvhMesh.mesh.matrixWorld).invert();
    });
  }

  /**
   * Raycast against all BVH meshes
   * Returns the closest hit or null
   */
  raycast(
    ray: THREE.Ray,
    maxDistance: number = Infinity
  ): THREE.Intersection | null {
    let closestHit: THREE.Intersection | null = null;
    let closestDistance = maxDistance;

    this.bvhMeshes.forEach((bvhMesh) => {
      // Transform ray to mesh local space
      const localRay = ray.clone();
      localRay.applyMatrix4(bvhMesh.invMatrixWorld);

      // Raycast against BVH
      const hit = bvhMesh.bvh.raycastFirst(localRay, THREE.FrontSide);

      if (hit) {
        // Transform hit point back to world space
        const worldPoint = hit.point.clone();
        worldPoint.applyMatrix4(bvhMesh.mesh.matrixWorld);

        // Calculate distance from ray origin
        const distance = ray.origin.distanceTo(worldPoint);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestHit = {
            distance,
            point: worldPoint,
            face: hit.face,
            faceIndex: hit.faceIndex,
            object: bvhMesh.mesh,
            uv: hit.uv,
            uv2: hit.uv2,
          };
        }
      }
    });

    return closestHit;
  }

  /**
   * Sphere cast against all BVH meshes
   * Useful for character collision detection
   */
  sphereCast(
    sphere: THREE.Sphere,
    direction: THREE.Vector3,
    maxDistance: number = Infinity
  ): THREE.Intersection | null {
    let closestHit: THREE.Intersection | null = null;
    let closestDistance = maxDistance;

    this.bvhMeshes.forEach((bvhMesh) => {
      // Transform sphere to mesh local space
      const localSphere = sphere.clone();
      localSphere.center.applyMatrix4(bvhMesh.invMatrixWorld);

      // Create a box for the swept sphere
      const box = new THREE.Box3();
      box.setFromCenterAndSize(
        localSphere.center,
        new THREE.Vector3(
          localSphere.radius * 2,
          localSphere.radius * 2,
          localSphere.radius * 2
        )
      );

      // Transform direction to local space
      const localDirection = direction.clone();
      localDirection.applyMatrix4(bvhMesh.invMatrixWorld);
      localDirection.normalize();

      // Extend box in direction
      const endPoint = localSphere.center
        .clone()
        .add(localDirection.multiplyScalar(maxDistance));
      box.expandByPoint(endPoint);

      // Check if box intersects BVH
      const boxToBvh = new THREE.Matrix4();
      boxToBvh.identity();
      if (bvhMesh.bvh.intersectsBox(box, boxToBvh)) {
        // Perform more detailed check (simplified - could be improved)
        const ray = new THREE.Ray(
          localSphere.center,
          localDirection
        );
        const hit = bvhMesh.bvh.raycastFirst(ray, THREE.FrontSide);

        if (hit) {
          const worldPoint = hit.point.clone();
          worldPoint.applyMatrix4(bvhMesh.mesh.matrixWorld);

          const distance = sphere.center.distanceTo(worldPoint);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestHit = {
              distance,
              point: worldPoint,
              face: hit.face,
              faceIndex: hit.faceIndex,
              object: bvhMesh.mesh,
              uv: hit.uv,
              uv2: hit.uv2,
            };
          }
        }
      }
    });

    return closestHit;
  }

  /**
   * Get ground height at a specific X, Z position
   * Useful for terrain following
   */
  getGroundHeight(x: number, z: number, maxDistance: number = 100): number | null {
    const ray = new THREE.Ray(
      new THREE.Vector3(x, maxDistance, z),
      new THREE.Vector3(0, -1, 0)
    );

    const hit = this.raycast(ray, maxDistance * 2);

    if (hit) {
      return hit.point.y;
    }

    return null;
  }

  /**
   * Check if a point is on ground (within threshold)
   */
  isOnGround(
    position: THREE.Vector3,
    threshold: number = 0.1,
    maxDistance: number = 2
  ): boolean {
    const groundHeight = this.getGroundHeight(
      position.x,
      position.z,
      maxDistance
    );

    if (groundHeight === null) {
      return false;
    }

    return Math.abs(position.y - groundHeight) < threshold;
  }

  /**
   * Get all BVH meshes (for debugging)
   */
  getAllBVHMeshes(): BVHMesh[] {
    return Array.from(this.bvhMeshes.values());
  }

  /**
   * Clear all BVH meshes
   */
  clear(): void {
    this.bvhMeshes.clear();
  }
}

// Singleton instance
export const bvhManager = new BVHManager();

