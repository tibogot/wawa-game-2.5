import { useControls, folder } from "leva";

export const useHeightFogControls = () => {
  return useControls("🌤️ AMBIENCE", {
    heightFog: folder(
      {
        heightFogEnabled: { value: false, label: "🌫️ Enable Height Fog" },
        fogColor: { value: "#cccccc", label: "Fog Color" },
        fogHeight: {
          value: 50.0,
          label: "Fog Height",
          min: 0,
          max: 200,
          step: 5,
        },
        fogNear: {
          value: 1,
          label: "Fog Near",
          min: 0.1,
          max: 50,
          step: 1,
        },
        fogFar: {
          value: 1300,
          label: "Fog Far",
          min: 10,
          max: 5000,
          step: 10,
        },
      },
      { collapsed: true }
    ),
  });
};
