import React, { useEffect, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { Lensflare, LensflareElement } from "three/addons/objects/Lensflare.js";

interface LensFlareProps {
  position?: [number, number, number];
  color?: string | number;
  intensity?: number;
  distance?: number;
  decay?: number;
  h?: number; // HSL hue (0-1)
  s?: number; // HSL saturation (0-1)
  l?: number; // HSL lightness (0-1)
}

export default function LensFlare({
  position = [0, 0, -1000],
  color = 0xffffff,
  intensity = 1.5,
  distance = 2000,
  decay = 0,
  h,
  s,
  l,
}: LensFlareProps) {
  const lightRef = useRef<THREE.PointLight>(null);

  // Load lens flare textures
  const [textureFlare0, textureFlare3] = useLoader(THREE.TextureLoader, [
    "/textures/lensflare0.png",
    "/textures/lensflare3.png",
  ]);

  useEffect(() => {
    if (!lightRef.current) return;

    const light = lightRef.current;

    // If HSL values are provided, use them instead of color prop
    if (h !== undefined && s !== undefined && l !== undefined) {
      light.color.setHSL(h, s, l, THREE.SRGBColorSpace);
    }

    // Create the lens flare
    const lensflare = new Lensflare();

    // Main flare at the center
    lensflare.addElement(
      new LensflareElement(textureFlare0, 700, 0, light.color)
    );

    // Secondary ghost elements
    lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
    lensflare.addElement(new LensflareElement(textureFlare3, 120, 0.9));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 1));

    // Add lens flare to light
    light.add(lensflare);

    // Cleanup
    return () => {
      light.remove(lensflare);
      lensflare.dispose();
    };
  }, [textureFlare0, textureFlare3, h, s, l]);

  return (
    <pointLight
      ref={lightRef}
      position={position}
      color={color}
      intensity={intensity}
      distance={distance}
      decay={decay}
    />
  );
}
