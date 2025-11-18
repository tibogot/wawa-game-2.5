import { useControls, folder } from "leva";

export default function useClaudeGrassQuick2Controls() {
  const controls = useControls("🌿 FOLIAGE", {
    claudeGrassQuick2: folder(
      {
        // Master toggle
        enabled: {
          value: false,
          label: "🌿 Enable Claude Grass Quick 2",
        },

        // Basic Settings
        basic: folder(
          {
            terrainSize: {
              value: 100,
              min: 50,
              max: 500,
              step: 10,
              label: "Terrain Size",
            },
            heightScale: {
              value: 1,
              min: 0,
              max: 10,
              step: 0.1,
              label: "Height Scale",
            },
            heightOffset: {
              value: 0,
              min: -10,
              max: 10,
              step: 0.1,
              label: "Height Offset",
            },
            grassWidth: {
              value: 0.1,
              min: 0.01,
              max: 1,
              step: 0.01,
              label: "Grass Width",
            },
            grassHeight: {
              value: 1.5,
              min: 0.1,
              max: 5,
              step: 0.1,
              label: "Grass Height",
            },
          },
          { collapsed: true }
        ),

        // LOD & Distance
        lod: folder(
          {
            lodDistance: {
              value: 15,
              min: 5,
              max: 50,
              step: 1,
              label: "LOD Distance",
            },
            maxDistance: {
              value: 100,
              min: 50,
              max: 200,
              step: 10,
              label: "Max Distance",
            },
            patchSize: {
              value: 10,
              min: 5,
              max: 20,
              step: 1,
              label: "Patch Size",
            },
          },
          { collapsed: true }
        ),

        // Specular / Moon Reflection
        specular: folder(
          {
            specularEnabled: {
              value: false,
              label: "Enable Specular / Moon Reflection",
            },
            lightDirectionX: {
              value: 1.0,
              min: -5.0,
              max: 5.0,
              step: 0.1,
              label: "Light Direction X",
            },
            lightDirectionY: {
              value: 1.0,
              min: -5.0,
              max: 5.0,
              step: 0.1,
              label: "Light Direction Y",
            },
            lightDirectionZ: {
              value: 0.5,
              min: -5.0,
              max: 5.0,
              step: 0.1,
              label: "Light Direction Z",
            },
            specularColor: {
              value: { r: 0.9, g: 0.95, b: 1.0 },
              label: "Specular Color",
            },
            specularIntensity: {
              value: 0.5,
              min: 0,
              max: 1,
              step: 0.01,
              label: "Specular Intensity",
            },
            shininess: {
              value: 30,
              min: 1,
              max: 200,
              step: 1,
              label: "Shininess",
            },
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
  });

  // Return the entire controls object - Leva flattens folder structure
  // The folder name becomes a key in the returned object
  return controls;
}
