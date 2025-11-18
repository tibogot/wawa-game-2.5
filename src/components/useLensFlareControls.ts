import { useControls } from "leva";

export const useLensFlareControls = () => {
  const controls = useControls(
    "Lens Flares",
    {
      lensFlareEnabled: {
        value: false,
        label: "Enable Lens Flares",
      },
      lensFlare1Enabled: {
        value: false,
        label: "Light 1 (Yellow)",
      },
      lensFlare1Position: {
        value: { x: 50, y: 30, z: -50 },
        label: "Light 1 Position",
        step: 1,
      },
      lensFlare1H: {
        value: 0.55,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Light 1 Hue",
      },
      lensFlare1S: {
        value: 0.9,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Light 1 Saturation",
      },
      lensFlare1L: {
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Light 1 Lightness",
      },
      lensFlare1Intensity: {
        value: 1.5,
        min: 0,
        max: 5,
        step: 0.1,
        label: "Light 1 Intensity",
      },
      lensFlare2Enabled: {
        value: false,
        label: "Light 2 (Cyan)",
      },
      lensFlare2Position: {
        value: { x: -50, y: 40, z: -30 },
        label: "Light 2 Position",
        step: 1,
      },
      lensFlare2H: {
        value: 0.08,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Light 2 Hue",
      },
      lensFlare2S: {
        value: 0.8,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Light 2 Saturation",
      },
      lensFlare2L: {
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Light 2 Lightness",
      },
      lensFlare2Intensity: {
        value: 1.2,
        min: 0,
        max: 5,
        step: 0.1,
        label: "Light 2 Intensity",
      },
      lensFlare3Enabled: {
        value: true,
        label: "Light 3 (Magenta)",
      },
      lensFlare3Position: {
        value: { x: 1500, y: 200, z: 1000 },
        label: "Light 3 Position",
        step: 1,
      },
      lensFlare3H: {
        value: 0.995,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Light 3 Hue",
      },
      lensFlare3S: {
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Light 3 Saturation",
      },
      lensFlare3L: {
        value: 0.9,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Light 3 Lightness",
      },
      lensFlare3Intensity: {
        value: 1.8,
        min: 0,
        max: 5,
        step: 0.1,
        label: "Light 3 Intensity",
      },
      flareDistance: {
        value: 2000,
        min: 100,
        max: 10000,
        step: 100,
        label: "Light Distance",
      },
    },
    { collapsed: true }
  );

  return controls;
};
