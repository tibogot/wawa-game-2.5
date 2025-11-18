import React, { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

interface HeightFogProps {
  enabled?: boolean;
  fogColor?: string;
  fogDensity?: number;
}

export const HeightFog: React.FC<HeightFogProps> = ({
  enabled = true,
  fogColor = "#efd1b5",
  fogDensity = 0.0025,
}) => {
  const { scene } = useThree();

  useEffect(() => {
    if (enabled) {
      scene.fog = new THREE.FogExp2(fogColor, fogDensity);
    } else {
      scene.fog = null;
    }

    return () => {
      scene.fog = null;
    };
  }, [enabled, fogColor, fogDensity, scene]);

  return null;
};
