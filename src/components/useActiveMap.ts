import { useMemo } from "react";
import { mapDefinitions, mapOrder } from "./mapDefinitions";
import { getTerrainHeightFromTexture } from "../utils/terrainUtils";
import * as THREE from "three";

const fallbackMapKey = "map16";

interface ActiveMapResult {
  mapKey: string;
  mapComponent: any;
  mapProps: Record<string, unknown>;
  spawnPosition: [number, number, number];
  requiresTerrainReadyCallback: boolean;
  supportsTeleport: boolean;
  directionalOverride?: [number, number, number];
}

export const useActiveMap = (
  mapKey: string,
  {
    characterPosition,
    characterVelocity,
    onTerrainReady,
    onTeleportRequest,
  }: {
    characterPosition: THREE.Vector3;
    characterVelocity: THREE.Vector3;
    onTerrainReady: () => void;
    onTeleportRequest: (request: any) => void;
  }
): ActiveMapResult => {
  return useMemo(() => {
    const activeDefinition =
      mapDefinitions[mapKey] ?? mapDefinitions[fallbackMapKey];
    const mapComponent = activeDefinition.component;
    const baseProps = activeDefinition.getDefaultProps();

    const mapProps: Record<string, unknown> = {
      ...baseProps,
    };

    if (activeDefinition.passCharacterData) {
      mapProps.characterPosition = characterPosition;
      mapProps.characterVelocity = characterVelocity;
    }

    // Always pass onTerrainReady to ALL maps to ensure terrain physics are ready before character spawns
    mapProps.onTerrainReady = onTerrainReady;

    if (activeDefinition.supportsTeleport) {
      mapProps.onTeleportRequest = onTeleportRequest;
    }

    if (activeDefinition.extendProps) {
      Object.assign(
        mapProps,
        activeDefinition.extendProps({
          onTerrainReady,
          onTeleportRequest,
        })
      );
    }

    const spawnPosition = activeDefinition.getCharacterSpawn
      ? activeDefinition.getCharacterSpawn({
          getTerrainHeightFromTexture,
        })
      : [0, 2, 0];

    return {
      mapKey,
      mapComponent,
      mapProps,
      spawnPosition,
      requiresTerrainReadyCallback:
        activeDefinition.requiresTerrainReadyCallback ?? false,
      supportsTeleport: activeDefinition.supportsTeleport ?? false,
      directionalOverride: activeDefinition.directionalOverride,
    };
  }, [
    mapKey,
    characterPosition,
    characterVelocity,
    onTerrainReady,
    onTeleportRequest,
  ]);
};

export const getDefaultMapKey = () => mapOrder[0] ?? fallbackMapKey;
