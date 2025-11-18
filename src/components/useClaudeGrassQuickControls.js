import { useControls, folder } from 'leva';

export default function useClaudeGrassQuickControls() {
  const controls = useControls('🌿 FOLIAGE', {
    claudeGrassQuick: folder({
      enabled: {
        value: false,
        label: '🌿 Enable Claude Grass Quick',
      },
      terrainSize: {
        value: 100,
        min: 50,
        max: 500,
        step: 10,
        label: 'Terrain Size',
      },
      heightScale: {
        value: 1,
        min: 0,
        max: 10,
        step: 0.1,
        label: 'Height Scale',
      },
      heightOffset: {
        value: 0,
        min: -10,
        max: 10,
        step: 0.1,
        label: 'Height Offset',
      },
      grassWidth: {
        value: 0.1,
        min: 0.01,
        max: 1,
        step: 0.01,
        label: 'Grass Width',
      },
      grassHeight: {
        value: 1.5,
        min: 0.1,
        max: 5,
        step: 0.1,
        label: 'Grass Height',
      },
      lodDistance: {
        value: 15,
        min: 5,
        max: 50,
        step: 1,
        label: 'LOD Distance',
      },
      maxDistance: {
        value: 100,
        min: 50,
        max: 200,
        step: 10,
        label: 'Max Distance',
      },
      patchSize: {
        value: 10,
        min: 5,
        max: 20,
        step: 1,
        label: 'Patch Size',
      },
    }),
  });

  return controls;
}
