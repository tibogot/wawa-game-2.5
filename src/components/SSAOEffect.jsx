import React, { useRef, Suspense, useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { EffectComposer, SMAA, N8AO, Bloom } from "@react-three/postprocessing";
import { BlendFunction, SMAAPreset } from "postprocessing";
import { useControls, folder } from "leva";

/**
 * Post-Processing Effects
 *
 * Includes:
 * - N8AO (Advanced Ambient Occlusion)
 * - Bloom (Bright objects glow)
 * - SMAA anti-aliasing
 */
export const SSAOEffect = () => {
  const { scene, camera } = useThree();

  const {
    enablePostProcessing,
    enableColorManagement,
    enabled,
    aoRadius,
    distanceFalloff,
    intensity,
    color,
    aoSamples,
    denoiseSamples,
    denoiseRadius,
    halfRes,
    gammaCorrection,
    enableBloom,
    bloomIntensity,
    bloomLuminanceThreshold,
    bloomLuminanceSmoothing,
    bloomMipmapBlur,
    antiAliasingMode,
    smaaPreset,
  } = useControls("🎬 POST PROCESSING", {
    masterToggle: folder(
      {
        enablePostProcessing: {
          value: false,
          label: "✨ Enable Post-Processing",
        },
        enableColorManagement: {
          value: true,
          label: "🎨 Enable Color Management (THREE.ColorManagement)",
        },
      },
      { collapsed: true }
    ),
    n8ao: folder(
      {
        enabled: {
          value: false,
          label: "✨ Enable N8AO",
        },
        aoRadius: {
          value: 2.0,
          min: 0.1,
          max: 50.0,
          step: 0.5,
          label: "📏 AO Radius (world units)",
        },
        distanceFalloff: {
          value: 1.0,
          min: 0.1,
          max: 5.0,
          step: 0.1,
          label: "📉 Distance Falloff",
        },
        intensity: {
          value: 5.0,
          min: 0.0,
          max: 20.0,
          step: 0.5,
          label: "💪 Intensity (darkness)",
        },
        color: {
          value: "#000000",
          label: "🎨 AO Color",
        },
        aoSamples: {
          value: 16,
          min: 4,
          max: 64,
          step: 1,
          label: "🎯 AO Samples (quality)",
        },
        denoiseSamples: {
          value: 4,
          min: 1,
          max: 16,
          step: 1,
          label: "🔧 Denoise Samples",
        },
        denoiseRadius: {
          value: 6,
          min: 1,
          max: 24,
          step: 1,
          label: "🔄 Denoise Radius",
        },
        halfRes: {
          value: false,
          label: "📊 Half Resolution (breaks HDRI!)",
        },
        gammaCorrection: {
          value: false,
          label: "🎨 Gamma Correction (disable to prevent artifacts)",
        },
      },
      { collapsed: true }
    ),
    bloom: folder(
      {
        enableBloom: {
          value: false,
          label: "🌟 Enable Bloom (Sun + Bright Objects Glow)",
        },
        bloomIntensity: {
          value: 1.5,
          min: 0.0,
          max: 5.0,
          step: 0.1,
          label: "💡 Bloom Intensity (Glow Strength)",
        },
        bloomLuminanceThreshold: {
          value: 0.8,
          min: 0.0,
          max: 1.0,
          step: 0.05,
          label: "🌟 Luminance Threshold (What Glows)",
        },
        bloomLuminanceSmoothing: {
          value: 0.3,
          min: 0.0,
          max: 1.0,
          step: 0.05,
          label: "🌊 Smoothing (Glow Softness)",
        },
        bloomMipmapBlur: {
          value: true,
          label: "🌀 Mipmap Blur (Better Quality)",
        },
      },
      { collapsed: true }
    ),
    antiAliasing: folder(
      {
        antiAliasingMode: {
          value: "msaa",
          options: {
            "None (Jagged)": "none",
            "MSAA (Default)": "msaa",
            "SMAA (Shader-based)": "smaa",
          },
          label: "AA Mode",
        },
        smaaPreset: {
          value: "high",
          options: ["low", "medium", "high", "ultra"],
          label: "SMAA Quality",
          render: (get) =>
            get("🎬 POST PROCESSING.antiAliasing.antiAliasingMode") === "smaa",
        },
      },
      { collapsed: true }
    ),
  });

  // Set up color management
  useEffect(() => {
    THREE.ColorManagement.enabled = enableColorManagement;
    // console.log(`🎨 Color Management enabled: ${enableColorManagement}`);
  }, [enableColorManagement]);

  // Map preset string to SMAAPreset enum
  const smaaPresetMap = {
    low: SMAAPreset.LOW,
    medium: SMAAPreset.MEDIUM,
    high: SMAAPreset.HIGH,
    ultra: SMAAPreset.ULTRA,
  };

  // Determine multisampling setting
  const multisampling =
    antiAliasingMode === "smaa" ? 0 : antiAliasingMode === "msaa" ? 8 : 0;

  // Only render post-processing if master toggle is enabled
  if (!enablePostProcessing) {
    return null;
  }

  return (
    <>
      <Suspense fallback={null}>
        <EffectComposer
          multisampling={multisampling}
          frameBufferType={THREE.HalfFloatType}
          enabled={true}
          renderPriority={1}
        >
          {/* N8AO - Advanced ambient occlusion (works with R3F!) */}
          {enabled && (
            <N8AO
              aoRadius={aoRadius}
              distanceFalloff={distanceFalloff}
              intensity={intensity}
              color={color}
              aoSamples={aoSamples}
              denoiseSamples={denoiseSamples}
              denoiseRadius={denoiseRadius}
              halfRes={halfRes}
              gammaCorrection={gammaCorrection}
            />
          )}

          {/* Bloom - Makes bright objects glow */}
          {enableBloom && (
            <Bloom
              intensity={bloomIntensity}
              luminanceThreshold={bloomLuminanceThreshold}
              luminanceSmoothing={bloomLuminanceSmoothing}
              mipmapBlur={bloomMipmapBlur}
              blendFunction={BlendFunction.SCREEN}
            />
          )}

          {/* SMAA Anti-Aliasing - Shader-based AA */}
          {antiAliasingMode === "smaa" && (
            <SMAA preset={smaaPresetMap[smaaPreset]} />
          )}
        </EffectComposer>
      </Suspense>
    </>
  );
};

export default SSAOEffect;
