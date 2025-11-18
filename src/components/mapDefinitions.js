import { Map1 } from "./Map1";
import { Map2 } from "./Map2";
import { Map3 } from "./Map3";
import { Map4 } from "./Map4";
import { Map5 } from "./Map5";
import { Map6 } from "./Map6";
import { Map7 } from "./Map7";
import { Map8 } from "./Map8";
import { Map9 } from "./Map9";
import { Map12 } from "./Map12";
import { Map15 } from "./Map15";
import { Map16 } from "./Map16";
import { Map17 } from "./Map17";
import { Map18 } from "./Map18";

const createDefaultProps = () => ({
  scale: 1,
  position: [0, 0, 0],
});

const createStaticSpawn = (position) => () => [...position];

export const mapDefinitions = {
  map1: {
    component: Map1,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 2, 0]),
    passCharacterData: true,
  },
  map2: {
    component: Map2,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 2, 0]),
  },
  map3: {
    component: Map3,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: ({ getTerrainHeightFromTexture }) => {
      const characterHeight = getTerrainHeightFromTexture(
        0,
        0,
        null,
        4000,
        200,
        0
      );
      return [0, characterHeight + 2, 0];
    },
    passCharacterData: true,
  },
  map4: {
    component: Map4,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 2, 0]),
  },
  map5: {
    component: Map5,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 2, 0]),
    passCharacterData: true,
    requiresTerrainReadyCallback: true,
  },
  map6: {
    component: Map6,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 5, 0]),
    passCharacterData: true,
  },
  map7: {
    component: Map7,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 5, 0]),
  },
  map8: {
    component: Map8,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 50, 0]),
    passCharacterData: true,
    requiresTerrainReadyCallback: true,
  },
  map9: {
    component: Map9,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 50, 0]),
    passCharacterData: true,
    requiresTerrainReadyCallback: true,
    directionalOverride: [-15, 80, 15],
  },
  map12: {
    component: Map12,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 50, 0]),
    passCharacterData: true,
    requiresTerrainReadyCallback: true,
  },
  map15: {
    component: Map15,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 2, 0]),
    requiresTerrainReadyCallback: true,
  },
  map16: {
    component: Map16,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 2, 0]),
    requiresTerrainReadyCallback: true,
    supportsTeleport: true,
  },
  map17: {
    component: Map17,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 2, 0]),
    requiresTerrainReadyCallback: true,
    supportsTeleport: true,
  },
  map18: {
    component: Map18,
    getDefaultProps: createDefaultProps,
    getCharacterSpawn: createStaticSpawn([0, 2, 0]),
    passCharacterData: true,
  },
};

export const mapOrder = Object.keys(mapDefinitions);
