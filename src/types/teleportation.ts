export type TeleportationRequest = {
  id: string;
  sourceId: string;
  targetId: string;
  targetPosition: [number, number, number];
  spawnPosition: [number, number, number];
  cameraPosition: [number, number, number];
  lookAtPosition: [number, number, number];
  delayMs?: number;
};
