import { useControls, folder } from "leva";

export const useInstancedTreesControls = () => {
  return useControls("🌿 FOLIAGE", {
    instancedTrees: folder(
      {
        instancedTreesEnabled: {
          value: false,
          label: "🌲 Enable Instanced Trees",
        },
        instancedTreeCount: {
          value: 50,
          label: "Tree Count",
          min: 1,
          max: 1000,
          step: 5,
        },
        instancedPositionX: {
          value: 0,
          label: "Center X",
          min: -200,
          max: 200,
          step: 5,
        },
        instancedPositionY: {
          value: 0,
          label: "Center Y",
          min: -50,
          max: 50,
          step: 1,
        },
        instancedPositionZ: {
          value: 0,
          label: "Center Z",
          min: -200,
          max: 200,
          step: 5,
        },
        instancedRadius: {
          value: 500,
          label: "Forest Radius",
          min: 10,
          max: 2000,
          step: 5,
        },
        instancedMinRadius: {
          value: 20,
          label: "Min Radius (Inner Ring)",
          min: 0,
          max: 150,
          step: 5,
        },
        scaleRangeMin: {
          value: 0.8,
          label: "Min Scale",
          min: 0.5,
          max: 1.5,
          step: 0.1,
        },
        scaleRangeMax: {
          value: 1.2,
          label: "Max Scale",
          min: 0.5,
          max: 2.0,
          step: 0.1,
        },
        castShadow: {
          value: false,
          label: "☀️ Cast Shadows",
        },
        receiveShadow: {
          value: true,
          label: "☀️ Receive Shadows",
        },
        enableTransparentSorting: {
          value: true,
          label: "🍃 Enable Transparent Sorting",
        },
        enableBVH: {
          value: true,
          label: "🔍 Enable BVH Culling",
        },
        bvhMargin: {
          value: 0.1,
          label: "BVH Margin",
          min: 0,
          max: 1,
          step: 0.1,
        },
        enableViewThickening: {
          value: true,
          label: "🍃 Enable View Thickening",
        },
        viewThickenPower: {
          value: 2.0,
          label: "📊 Thicken Curve Power",
          min: 1.0,
          max: 5.0,
          step: 0.5,
        },
        viewThickenStrength: {
          value: 0.3,
          label: "💪 Thicken Strength",
          min: 0.0,
          max: 1.5,
          step: 0.1,
        },
      },
      { collapsed: true }
    ),
  });
};
