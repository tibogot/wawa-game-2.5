import { useControls } from "leva";

export const useFloorDebugSpheresControls = () => {
  return useControls("🔍 Floor Debug Spheres", {
    enabled: {
      value: false,
      label: "✨ Enable Floor Debug Spheres",
    },
    gridSize: {
      value: 15,
      min: 5,
      max: 30,
      step: 1,
      label: "📐 Grid Size (15x15 = 225 spheres)",
    },
    areaSize: {
      value: 500,
      min: 100,
      max: 1500,
      step: 50,
      label: "🗺️ Area Size (How Wide to Cover)",
    },
    sphereSize: {
      value: 3,
      min: 0.5,
      max: 10,
      step: 0.5,
      label: "⚫ Sphere Size",
    },
    sphereColor: {
      value: "#00ff00",
      label: "🎨 Sphere Color",
    },
    emissiveIntensity: {
      value: 0.8,
      min: 0,
      max: 2,
      step: 0.1,
      label: "💡 Glow Intensity",
    },
  });
};
