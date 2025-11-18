import React, { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { InstancedMesh2, createRadixSort } from "@three.ez/instanced-mesh";

/**
 * 🌲 INSTANCED TREES - Performance-optimized tree forest using InstancedMesh2
 *
 * Features:
 * - Uses InstancedMesh2 for efficient rendering of many trees
 * - Creates SEPARATE InstancedMesh2 for each mesh (trunk + leaves)
 * - Handles transparency for shadows (alphaTest on leaves)
 * - Supports terrain height positioning
 * - Randomization (position, rotation, scale)
 * - BVH for frustum culling
 * - Transparent sorting for leaves
 * - Optional LOD support
 */
export const InstancedTrees = ({
  count = 5,
  position = [0, 0, 0],
  radius = 50,
  minRadius = 0,
  scaleRange = [0.8, 1.2],
  enabled = true,
  getTerrainHeight,
  enableBVH = true,
  bvhMargin = 0.1,
  enableLOD = false,
  lodDistances = [],
  lodGeometries = [],
  lodMaterials = [],
  enableShadowLOD = false,
  shadowLodDistances = [],
  castShadow = true,
  receiveShadow = true,
  enableTransparentSorting = true,
  enableViewThickening = true,
  viewThickenPower = 2.0,
  viewThickenStrength = 0.3,
}) => {
  const { scene } = useGLTF("/models/tree_elm-transformed.glb");
  const { scene: threeScene, gl, camera } = useThree();
  const instancedMeshesRef = useRef([]);
  const materialsRef = useRef([]);
  const groupRef = useRef(null);

  // Store mesh extraction data separately
  const meshesDataRef = useRef(null);

  // ========== CORE SETUP: Only recreate when essential props change ==========
  useEffect(() => {
    if (!enabled || !scene) return;

    const setupInstancedTrees = () => {
      console.log("🌲 INSTANCED TREES - Setting up...");
      console.log(`   Tree count: ${count.toLocaleString()}`);
      console.log(`   Radius: ${minRadius} - ${radius}`);
      console.log(`   Scale range: ${scaleRange[0]} - ${scaleRange[1]}`);

      // ========== STEP 1: Extract ALL meshes from tree model (trunk + leaves) ==========
      const meshes = [];

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Clone geometry to avoid modifying original
          const geometry = child.geometry.clone();

          // Apply the mesh's world matrix to the geometry to preserve GLB hierarchy transformations
          // This ensures the tree is oriented correctly (vertical trunk, leaves on branches)
          child.updateMatrixWorld(true); // Update world matrix
          geometry.applyMatrix4(child.matrixWorld);

          // Recalculate normals after applying transformation
          geometry.computeVertexNormals();

          // Update bounding box after transformation
          geometry.computeBoundingBox();

          meshes.push({
            geometry: geometry,
            material: child.material,
            name: child.name || `mesh_${meshes.length}`,
          });
        }
      });

      if (meshes.length === 0) {
        console.error("❌ No meshes found in tree_elm-transformed.glb!");
        return;
      }

      console.log(`📦 Found ${meshes.length} meshes (trunk + leaves)`);

      // Calculate total complexity
      let totalTrianglesPerTree = 0;
      meshes.forEach((meshData, idx) => {
        const vertexCount = meshData.geometry.attributes.position.count;
        const triangles = vertexCount / 3;
        totalTrianglesPerTree += triangles;
        console.log(
          `   Mesh ${idx + 1} (${meshData.name}): ${triangles.toFixed(
            0
          )} triangles`
        );
      });

      const totalTriangles = totalTrianglesPerTree * count;
      console.log(
        `✅ Total per tree: ${totalTrianglesPerTree.toFixed(0)} triangles`
      );
      console.log(
        `   Total for ${count} trees: ${totalTriangles.toFixed(0)} triangles`
      );

      // ========== STEP 2: Calculate bounding box for terrain positioning ==========
      // MUST be done BEFORE generating transforms (needed for terrain height adjustment)
      // Use the same logic as Tree component - calculate bottom offset without scale first
      let treeBottomOffset = 0;
      if (getTerrainHeight) {
        // Calculate bounding box for the unscaled tree (like Tree component)
        const tempGroup = new THREE.Group();
        const tempScene = scene.clone();
        tempGroup.add(tempScene);
        const bbox = new THREE.Box3();
        bbox.setFromObject(tempGroup);
        treeBottomOffset = bbox.min.y;
        tempGroup.clear();
        console.log(`   📐 Tree bottom offset: ${treeBottomOffset.toFixed(2)}`);
      }

      // ========== STEP 3: Pre-generate ALL tree transformation data ==========
      // CRITICAL: Generate ALL random values ONCE and store them
      // This ensures trunk and leaves use EXACTLY the same transformations
      const treeTransforms = [];

      for (let i = 0; i < count; i++) {
        // Random position in ring (donut shape)
        const angle = Math.random() * Math.PI * 2;
        const distance = minRadius + Math.random() * (radius - minRadius);

        const x = position[0] + Math.cos(angle) * distance;
        const z = position[2] + Math.sin(angle) * distance;

        // Generate random scale and rotation ONCE and store them
        const randomScale =
          Math.random() * (scaleRange[1] - scaleRange[0]) + scaleRange[0];
        const randomRotation = Math.random() * Math.PI * 2;

        // Calculate terrain-adjusted Y position (using pre-calculated treeBottomOffset)
        let finalY = position[1];
        if (getTerrainHeight) {
          const terrainY = getTerrainHeight(x, z);
          const scaledBottomOffset = treeBottomOffset * randomScale;
          finalY = terrainY - scaledBottomOffset;
        }

        // Store ALL transformation data for this tree
        treeTransforms.push({
          position: new THREE.Vector3(x, finalY, z),
          scale: randomScale,
          rotation: randomRotation,
        });
      }

      console.log(
        `   ✅ Generated ${treeTransforms.length.toLocaleString()} tree transforms (positions, scales, rotations)`
      );

      // ========== STEP 4: Create SEPARATE InstancedMesh2 for EACH mesh (trunk + leaves) ==========
      const instancedMeshes = [];

      meshes.forEach((meshData, meshIdx) => {
        console.log(`\n🌲 Creating InstancedMesh2 for ${meshData.name}...`);

        // Clone material to avoid modifying original
        const material = meshData.material.clone();
        material.needsUpdate = true;

        // Check if this is transparent (likely leaves)
        // Only mark as transparent if it's explicitly transparent or has low opacity
        // Don't check material.map - that would mark all textured materials as transparent!
        const isTransparent =
          material.transparent === true ||
          (material.opacity !== undefined && material.opacity < 0.99);

        // Apply custom transparency settings to leaves (like InstancedMesh2Trees)
        if (isTransparent) {
          material.transparent = true;
          material.alphaTest = 0.5; // Critical for shadow cutouts!
          material.side = THREE.DoubleSide; // Render both sides of leaves
          // Use depthWrite based on alphaTest value (like InstancedMesh2Trees)
          // If alphaTest is high (>0.8), we can use depthWrite for better performance
          material.depthWrite = material.alphaTest > 0.8;

          // Add view-space thickening shader effect for leaves (makes them less flat)
          if (enableViewThickening) {
            material.onBeforeCompile = (shader) => {
              // Inject view-space thickening code (similar to FloatingLeaves2 and grass)
              shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                `
                #include <begin_vertex>
                
                // View-space thickening: Prevents leaves from disappearing when viewed edge-on
                // Calculate instance world position (for instanced meshes)
                vec3 instanceLocalPos = vec3(instanceMatrix[3].xyz);
                vec4 instancePosWorld = modelMatrix * vec4(instanceLocalPos, 1.0);
                vec3 instanceWorldPos = instancePosWorld.xyz;
                
                // Get camera position in world space
                vec3 camPos = (inverse(viewMatrix) * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                
                // Get view direction from camera to leaf
                vec3 viewDir = normalize(camPos - instanceWorldPos);
                
                // Calculate vertex normal in world space
                vec3 worldNormal = normalize(normalMatrix * objectNormal);
                
                // Calculate how edge-on we're viewing the leaf
                float viewDotNormal = abs(dot(viewDir, worldNormal));
                
                // Thickening factor: high when edge-on (low dot), low when facing camera
                float thickenFactor = pow(1.0 - viewDotNormal, ${viewThickenPower.toFixed(
                  1
                )});
                
                // Apply smoothing to avoid visual artifacts
                thickenFactor *= smoothstep(0.0, 0.3, viewDotNormal);
                
                // Apply thickening by pushing vertices outward along the normal
                // Use a small offset based on the model's scale
                vec3 offset = worldNormal * thickenFactor * ${viewThickenStrength.toFixed(
                  2
                )} * 0.5;
                transformed += offset;
                `
              );
            };
          }

          console.log(
            `   🍃 Leaves material: transparent=true, alphaTest=${material.alphaTest}, depthWrite=${material.depthWrite}, side=DoubleSide, viewThickening=${enableViewThickening}`
          );
        }

        const instancedMesh = new InstancedMesh2(meshData.geometry, material, {
          capacity: count,
          createEntities: false,
          renderer: gl,
        });

        // Set camera reference for LOD updates
        instancedMesh.camera = camera;

        // Configure shadows (can be expensive - make optional)
        instancedMesh.castShadow = castShadow;
        instancedMesh.receiveShadow = receiveShadow;
        console.log(
          `   ☀️ Shadows: cast=${castShadow}, receive=${receiveShadow}`
        );

        // Add all tree instances using PRE-GENERATED transformation data
        // CRITICAL: Both trunk and leaves use the SAME stored transformations
        // This ensures perfect synchronization - no desync issues!
        instancedMesh.addInstances(count, (obj, index) => {
          // Use the PRE-GENERATED transform data (same for trunk and leaves)
          const transform = treeTransforms[index];

          // Apply the stored position, scale, and rotation
          obj.position.copy(transform.position);
          obj.scale.setScalar(transform.scale);

          // Use rotateY directly (like OctahedralForest) - works with InstancedMesh2
          obj.rotateY(transform.rotation);

          obj.updateMatrix();
        });

        console.log(`   ✅ Added ${count} instances with randomization`);

        // Enable sorting for transparent leaves (can be expensive with many instances)
        if (isTransparent && enableTransparentSorting) {
          console.log("   🍃 Enabling transparent sorting for leaves");
          instancedMesh.sortObjects = true;
          // Enable radix sort for better performance with transparent objects
          instancedMesh.customSort = createRadixSort(instancedMesh);
        } else if (isTransparent && !enableTransparentSorting) {
          console.log(
            "   🍃 Transparent sorting DISABLED (performance optimization)"
          );
        }

        // Compute BVH for FAST frustum culling
        if (enableBVH) {
          instancedMesh.computeBVH({ margin: bvhMargin });
        }

        // Add LOD levels if enabled (simplified geometry for each mesh)
        if (enableLOD && lodGeometries.length > 0) {
          console.log(`   🔧 Adding ${lodGeometries.length} LOD level(s)...`);
          lodGeometries.forEach((lodGeo, index) => {
            if (lodGeo && lodMaterials && lodMaterials[index]) {
              const lodDist = lodDistances[index] || 50 * (index + 1);
              instancedMesh.addLOD(lodGeo, lodMaterials[index], lodDist);
              console.log(`      ✅ LOD ${index + 1} added at ${lodDist}m`);
            }
          });
        }

        // Add SHADOW LOD for better shadow performance!
        if (enableShadowLOD && lodGeometries.length > 0) {
          console.log("   ☀️ Adding Shadow LOD levels...");
          lodGeometries.forEach((lodGeo, index) => {
            if (lodGeo) {
              const shadowDist = shadowLodDistances[index] || 50 * (index + 1);
              instancedMesh.addShadowLOD(lodGeo, shadowDist);
              console.log(
                `      ✅ Shadow LOD ${index + 1} added at ${shadowDist}m`
              );
            }
          });
        }

        // Add to scene
        if (!groupRef.current) {
          groupRef.current = new THREE.Group();
          threeScene.add(groupRef.current);
        }
        groupRef.current.add(instancedMesh);
        instancedMeshes.push(instancedMesh);
      });

      // ========== FINAL STATS ==========
      console.log(`\n✅ All ${meshes.length} tree meshes ready!`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🌲 Trees: ${count.toLocaleString()}`);
      console.log(`📊 Draw calls: ${meshes.length} (one per mesh type)`);
      console.log(
        `🎯 Frustum Culling: ${enableBVH ? "BVH enabled" : "Disabled"}`
      );
      console.log(`📊 LOD System: ${enableLOD ? "Enabled" : "Disabled"}`);
      console.log(`☀️  Shadows: cast=${castShadow}, receive=${receiveShadow}`);
      console.log(
        `☀️  Shadow LOD: ${enableShadowLOD ? "Enabled" : "Disabled"}`
      );
      console.log(
        `🍃 Transparent sorting: ${
          enableTransparentSorting ? "Enabled" : "Disabled"
        } for leaves`
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // Store mesh data for later updates
      meshesDataRef.current = meshes;
      instancedMeshesRef.current = instancedMeshes;
      materialsRef.current = instancedMeshes.map((mesh) => mesh.material);
    };

    setupInstancedTrees();

    // Cleanup
    return () => {
      instancedMeshesRef.current.forEach((mesh) => {
        if (groupRef.current) {
          groupRef.current.remove(mesh);
        } else {
          threeScene.remove(mesh);
        }
        mesh.dispose();
      });
      instancedMeshesRef.current = [];
      materialsRef.current = [];
      if (groupRef.current && groupRef.current.children.length === 0) {
        threeScene.remove(groupRef.current);
        groupRef.current = null;
      }
    };
  }, [
    // Only recreate when these essential props change
    scene,
    count,
    position,
    radius,
    minRadius,
    scaleRange,
    enabled,
    getTerrainHeight,
    enableBVH,
    bvhMargin,
    enableLOD,
    lodDistances,
    lodGeometries,
    lodMaterials,
    enableShadowLOD,
    shadowLodDistances,
    threeScene,
    gl,
    camera,
  ]);

  // ========== MATERIAL UPDATES: Update existing materials without recreating meshes ==========
  useEffect(() => {
    if (!instancedMeshesRef.current.length || !materialsRef.current.length)
      return;

    // Update material properties without recreating meshes
    materialsRef.current.forEach((material, index) => {
      if (!material) return;

      // Check if material is transparent (leaves)
      const isTransparent =
        material.transparent === true ||
        (material.opacity !== undefined && material.opacity < 0.99);

      if (isTransparent) {
        // Update transparent sorting
        const instancedMesh = instancedMeshesRef.current[index];
        if (instancedMesh) {
          if (enableTransparentSorting) {
            instancedMesh.sortObjects = true;
            instancedMesh.customSort = createRadixSort(instancedMesh);
          } else {
            instancedMesh.sortObjects = false;
            instancedMesh.customSort = null;
          }
        }

        // Note: View thickening shader code is baked into the material during creation
        // Changing viewThickenPower/Strength would require shader recompilation
        // For now, these changes will require a recreation (acceptable trade-off)
        // The shader is compiled once with the values at creation time
      }

      // Update shadow settings
      const instancedMesh = instancedMeshesRef.current[index];
      if (instancedMesh) {
        instancedMesh.castShadow = castShadow;
        instancedMesh.receiveShadow = receiveShadow;
      }
    });
  }, [
    castShadow,
    receiveShadow,
    enableTransparentSorting,
    // Note: viewThickenPower/Strength changes require recreation (shader recompilation)
    // This is acceptable as these are rarely changed
  ]);

  return null;
};

// Preload the model
useGLTF.preload("/models/tree_elm-transformed.glb");
