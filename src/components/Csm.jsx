import { useEffect, useMemo, useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CSM as ThreeCSM } from "three/examples/jsm/csm/CSM.js";

const defaultDirection = new THREE.Vector3(1, -1, 1).normalize();
const defaultColor = new THREE.Color(0xffffff);

const normalizeDirection = (direction) => {
  if (!direction) {
    return defaultDirection.clone();
  }

  if (direction instanceof THREE.Vector3) {
    if (direction.lengthSq() === 0) {
      return defaultDirection.clone();
    }
    return direction.clone().normalize();
  }

  if (Array.isArray(direction) && direction.length === 3) {
    const vec = new THREE.Vector3(direction[0], direction[1], direction[2]);
    if (vec.lengthSq() === 0) {
      return defaultDirection.clone();
    }
    return vec.normalize();
  }

  return defaultDirection.clone();
};

const toColor = (color) => {
  if (color instanceof THREE.Color) {
    return color.clone();
  }
  try {
    return new THREE.Color(color);
  } catch (error) {
    return defaultColor.clone();
  }
};

const removeCsmDefines = (material) => {
  if (!material || !material.defines) {
    return;
  }

  const { defines } = material;
  let changed = false;

  if ("USE_CSM" in defines) {
    delete defines.USE_CSM;
    changed = true;
  }
  if ("CSM_CASCADES" in defines) {
    delete defines.CSM_CASCADES;
    changed = true;
  }
  if ("CSM_FADE" in defines) {
    delete defines.CSM_FADE;
    changed = true;
  }

  if (changed) {
    if (Object.keys(defines).length === 0) {
      delete material.defines;
    }
    material.needsUpdate = true;
  }
};

const restoreMaterialAfterCsm = (material, record, csmInstance) => {
  if (!material || !record) {
    return;
  }

  if (record.wrappedOnBeforeCompile) {
    if (material.onBeforeCompile === record.wrappedOnBeforeCompile) {
      if (record.originalOnBeforeCompile) {
        material.onBeforeCompile = record.originalOnBeforeCompile;
      } else {
        delete material.onBeforeCompile;
      }
    } else if (record.originalOnBeforeCompile) {
      material.onBeforeCompile = record.originalOnBeforeCompile;
    }
  }

  removeCsmDefines(material);

  if (csmInstance && csmInstance.shaders && csmInstance.shaders.has(material)) {
    csmInstance.shaders.delete(material);
  }

  material.needsUpdate = true;
};

const patchMaterialWithCsm = (
  material,
  csmInstance,
  materialVersion,
  patchedMaterials
) => {
  if (!material) {
    return;
  }

  const existing = patchedMaterials.get(material);
  if (existing && existing.version === materialVersion) {
    return;
  }

  if (existing) {
    restoreMaterialAfterCsm(material, existing, csmInstance);
    patchedMaterials.delete(material);
  }

  const originalOnBeforeCompile = material.onBeforeCompile;

  csmInstance.setupMaterial(material);

  const csmOnBeforeCompile = material.onBeforeCompile;

  const wrappedOnBeforeCompile = function (shader) {
    const context = this;
    if (csmOnBeforeCompile) {
      csmOnBeforeCompile.call(context, shader);
    }
    if (originalOnBeforeCompile) {
      originalOnBeforeCompile.call(context, shader);
    }
  };

  material.onBeforeCompile = wrappedOnBeforeCompile;
  material.needsUpdate = true;

  patchedMaterials.set(material, {
    version: materialVersion,
    originalOnBeforeCompile,
    csmOnBeforeCompile,
    wrappedOnBeforeCompile,
  });
};

const applyCsmToScene = (scene, csm, materialVersion, patchedMaterials) => {
  scene.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((material) =>
      patchMaterialWithCsm(material, csm, materialVersion, patchedMaterials)
    );
  });
};

export const Csm = ({
  enabled,
  cascades = 4,
  shadowMapSize = 2048,
  shadowBias = 0,
  shadowNormalBias = 0,
  lightDirection,
  lightIntensity = 1,
  lightColor = defaultColor,
  fade = true,
  lightMargin = 200,
  maxFar,
  materialVersion,
}) => {
  const { scene, camera } = useThree();
  const csmRef = useRef(null);
  const patchedMaterialsRef = useRef(new Map());

  const restoreAllPatchedMaterials = useCallback(() => {
    const csmInstance = csmRef.current;
    const patchedMaterials = patchedMaterialsRef.current;
    if (!patchedMaterials.size) {
      return;
    }

    patchedMaterials.forEach((record, material) => {
      restoreMaterialAfterCsm(material, record, csmInstance);
    });

    patchedMaterials.clear();
  }, []);

  const normalizedDirection = useMemo(
    () => normalizeDirection(lightDirection),
    [lightDirection]
  );

  const colorInstance = useMemo(() => toColor(lightColor), [lightColor]);

  useEffect(() => {
    if (!enabled) {
      restoreAllPatchedMaterials();
      if (csmRef.current) {
        csmRef.current.remove();
        csmRef.current.dispose();
        csmRef.current = null;
      }
      return;
    }

    const csm = new ThreeCSM({
      camera,
      parent: scene,
      cascades,
      shadowMapSize,
      shadowBias,
      lightDirection: normalizedDirection,
      lightIntensity,
      maxFar: maxFar ?? camera.far,
      lightMargin,
    });

    csm.fade = fade;

    csm.lights.forEach((light) => {
      light.castShadow = true;
      light.intensity = lightIntensity;
      light.color.copy(colorInstance);
      light.shadow.bias = shadowBias;
      light.shadow.normalBias = shadowNormalBias;
      light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    });

    csm.updateFrustums();
    applyCsmToScene(scene, csm, materialVersion, patchedMaterialsRef.current);
    csmRef.current = csm;

    return () => {
      restoreAllPatchedMaterials();
      csm.remove();
      csm.dispose();
      csmRef.current = null;
    };
  }, [
    enabled,
    cascades,
    shadowMapSize,
    shadowBias,
    shadowNormalBias,
    normalizedDirection,
    lightIntensity,
    colorInstance,
    fade,
    lightMargin,
    maxFar,
    camera,
    scene,
    materialVersion,
    restoreAllPatchedMaterials,
  ]);

  useEffect(() => {
    if (!enabled || !csmRef.current) {
      return;
    }

    applyCsmToScene(
      scene,
      csmRef.current,
      materialVersion,
      patchedMaterialsRef.current
    );
    csmRef.current.updateFrustums();
  }, [enabled, materialVersion, scene]);

  useFrame(() => {
    if (!enabled || !csmRef.current) {
      return;
    }

    csmRef.current.update();
  }, -1);

  return null;
};

export default Csm;
