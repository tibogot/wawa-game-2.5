import { RigidBody } from "@react-three/rapier";
import { useRef, useMemo, useEffect } from "react";
import { useControls, folder } from "leva";
import ClaudeGrassQuick from "./ClaudeGrassQuick";
import ClaudeGrassQuick2 from "./ClaudeGrassQuick2";
import ClaudeGrassQuick5 from "./ClaudeGrassQuick5";
import useClaudeGrassQuickControls from "./useClaudeGrassQuickControls";
import useClaudeGrassQuick2Controls from "./useClaudeGrassQuick2Controls";
import useClaudeGrassQuick5Controls from "./useClaudeGrassQuick5Controls";
import { useLensFlareControls } from "./useLensFlareControls";
import LensFlare from "./LensFlare";
import { Skybox } from "./Skybox";
import HorizonSky from "./HorizonSky";
import * as THREE from "three";
import { TileMaterial } from "./TileMaterial";
import { TILE_REFERENCE_SCALE, TILE_DENSITY } from "./tileMaterialConfig";

export const Map18 = ({
  scale = 1,
  position = [0, 0, 0],
  characterPosition,
  characterVelocity,
  onTerrainReady,
  ...props
}) => {
  const group = useRef();

  const { buildingGeometry, buildingPosition } = useMemo(() => {
    const width = 18 * scale;
    const height = 60 * scale;
    const depth = 14 * scale;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const tileSize = 1 / TILE_DENSITY;

    const positionAttr = geometry.attributes.position;
    const normalAttr = geometry.attributes.normal;
    const uvAttr = geometry.attributes.uv;

    const positionVector = new THREE.Vector3();
    const normalVector = new THREE.Vector3();

    for (let i = 0; i < uvAttr.count; i++) {
      positionVector.fromBufferAttribute(positionAttr, i);
      normalVector.fromBufferAttribute(normalAttr, i);

      const absNormalX = Math.abs(normalVector.x);
      const absNormalY = Math.abs(normalVector.y);
      const absNormalZ = Math.abs(normalVector.z);

      if (absNormalX >= absNormalY && absNormalX >= absNormalZ) {
        const u = (positionVector.z + depth * 0.5) / tileSize;
        const v = (positionVector.y + height * 0.5) / tileSize;
        uvAttr.setXY(i, u, v);
      } else if (absNormalY >= absNormalX && absNormalY >= absNormalZ) {
        const u = (positionVector.x + width * 0.5) / tileSize;
        const v = (positionVector.z + depth * 0.5) / tileSize;
        uvAttr.setXY(i, u, v);
      } else {
        const u = (positionVector.x + width * 0.5) / tileSize;
        const v = (positionVector.y + height * 0.5) / tileSize;
        uvAttr.setXY(i, u, v);
      }
    }

    uvAttr.needsUpdate = true;

    return {
      buildingGeometry: geometry,
      buildingPosition: [
        position[0] - 30 * scale,
        position[1] + height / 2,
        position[2] - 20 * scale,
      ],
    };
  }, [scale, position]);

  useEffect(() => {
    return () => {
      buildingGeometry.dispose();
    };
  }, [buildingGeometry]);

  // Simple ground height function for flat plane
  const getGroundHeight = useMemo(
    () => (x, z) => 0, // Flat plane at y=0
    []
  );

  // Get ClaudeGrassQuick controls
  const claudeGrassQuickControls = useClaudeGrassQuickControls();
  // Get ClaudeGrassQuick2 controls
  // Leva flattens folder structure - all properties are at top level
  const claudeGrassQuick2Controls = useClaudeGrassQuick2Controls();
  // Get ClaudeGrassQuick5 controls
  const claudeGrassQuick5Controls = useClaudeGrassQuick5Controls();

  // Get LensFlare controls
  const {
    lensFlareEnabled,
    lensFlare1Enabled,
    lensFlare1Position,
    lensFlare1H,
    lensFlare1S,
    lensFlare1L,
    lensFlare1Intensity,
    lensFlare2Enabled,
    lensFlare2Position,
    lensFlare2H,
    lensFlare2S,
    lensFlare2L,
    lensFlare2Intensity,
    lensFlare3Enabled,
    lensFlare3Position,
    lensFlare3H,
    lensFlare3S,
    lensFlare3L,
    lensFlare3Intensity,
    flareDistance,
  } = useLensFlareControls();

  // Get Map18 controls
  const {
    skyboxEnabled,
    horizonSkyEnabled,
    horizonSkyTopColor,
    horizonSkyBottomColor,
    horizonSkyOffset,
    horizonSkyExponent,
    horizonSkyRadius,
  } = useControls("🗺️ MAP 18", {
    skybox: folder(
      {
        skyboxEnabled: {
          value: true,
          label: "🌌 Enable Skybox",
        },
      },
      { collapsed: true }
    ),
    horizonSky: folder(
      {
        horizonSkyEnabled: {
          value: true,
          label: "🌅 Enable Horizon Sky",
        },
        horizonSkyTopColor: {
          value: "#0077ff",
          label: "🎨 Top Color",
        },
        horizonSkyBottomColor: {
          value: "#ffffff",
          label: "🎨 Bottom Color",
        },
        horizonSkyOffset: {
          value: 33,
          min: 0,
          max: 100,
          step: 1,
          label: "⬆️ Offset",
        },
        horizonSkyExponent: {
          value: 0.6,
          min: 0.1,
          max: 5,
          step: 0.1,
          label: "📈 Exponent",
        },
        horizonSkyRadius: {
          value: 4000,
          min: 500,
          max: 8000,
          step: 100,
          label: "🪐 Radius",
        },
      },
      { collapsed: true }
    ),
  });

  // Create stable fallback vectors
  const fallbackPosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const fallbackVelocity = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Call onTerrainReady after physics are initialized (simple maps with static geometry)
  useEffect(() => {
    if (onTerrainReady) {
      // Delay to ensure RigidBody physics are fully initialized
      const timer = setTimeout(() => {
        onTerrainReady();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [onTerrainReady]);

  return (
    <group ref={group} {...props}>
      {skyboxEnabled && <Skybox />}
      {horizonSkyEnabled && (
        <HorizonSky
          topColor={horizonSkyTopColor}
          bottomColor={horizonSkyBottomColor}
          offset={horizonSkyOffset}
          exponent={horizonSkyExponent}
          radius={horizonSkyRadius}
        />
      )}

      <RigidBody type="fixed" colliders="trimesh">
        <mesh
          position={position}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={scale}
          receiveShadow
        >
          <planeGeometry args={[200, 200]} />
          <TileMaterial textureScale={TILE_REFERENCE_SCALE} />
        </mesh>
      </RigidBody>
      <RigidBody
        type="fixed"
        colliders="cuboid"
        position={buildingPosition}
        friction={1}
        restitution={0}
      >
        <mesh castShadow receiveShadow>
          <primitive object={buildingGeometry} />
          <TileMaterial textureScale={TILE_DENSITY} />
        </mesh>
      </RigidBody>

      {/* ClaudeGrassQuick - Quick_Grass port with advanced shaders */}
      {claudeGrassQuickControls.enabled && (
        <ClaudeGrassQuick
          playerPosition={
            new THREE.Vector3(
              characterPosition[0],
              characterPosition[1],
              characterPosition[2]
            )
          }
          terrainSize={claudeGrassQuickControls.terrainSize}
          heightScale={claudeGrassQuickControls.heightScale}
          heightOffset={claudeGrassQuickControls.heightOffset}
          grassWidth={claudeGrassQuickControls.grassWidth}
          grassHeight={claudeGrassQuickControls.grassHeight}
          lodDistance={claudeGrassQuickControls.lodDistance}
          maxDistance={claudeGrassQuickControls.maxDistance}
          patchSize={claudeGrassQuickControls.patchSize}
        />
      )}

      {/* ClaudeGrassQuick2 - Quick_Grass port with advanced shaders (Working Version) */}
      {claudeGrassQuick2Controls &&
        claudeGrassQuick2Controls.enabled === true && (
          <ClaudeGrassQuick2
            playerPosition={
              new THREE.Vector3(
                characterPosition[0],
                characterPosition[1],
                characterPosition[2]
              )
            }
            terrainSize={claudeGrassQuick2Controls.terrainSize}
            heightScale={claudeGrassQuick2Controls.heightScale}
            heightOffset={claudeGrassQuick2Controls.heightOffset}
            grassWidth={claudeGrassQuick2Controls.grassWidth}
            grassHeight={claudeGrassQuick2Controls.grassHeight}
            lodDistance={claudeGrassQuick2Controls.lodDistance}
            maxDistance={claudeGrassQuick2Controls.maxDistance}
            patchSize={claudeGrassQuick2Controls.patchSize}
            specularEnabled={claudeGrassQuick2Controls.specularEnabled}
            lightDirectionX={claudeGrassQuick2Controls.lightDirectionX}
            lightDirectionY={claudeGrassQuick2Controls.lightDirectionY}
            lightDirectionZ={claudeGrassQuick2Controls.lightDirectionZ}
            specularColor={claudeGrassQuick2Controls.specularColor}
            specularIntensity={claudeGrassQuick2Controls.specularIntensity}
            shininess={claudeGrassQuick2Controls.shininess}
          />
        )}

      {/* ClaudeGrassQuick5 - Quick_Grass port (New working version) */}
      {claudeGrassQuick5Controls.enabled && (
        <ClaudeGrassQuick5
          playerPosition={characterPosition || [0, 0, 0]}
          terrainSize={claudeGrassQuick5Controls.terrainSize}
          heightScale={claudeGrassQuick5Controls.heightScale}
          heightOffset={claudeGrassQuick5Controls.heightOffset}
          grassWidth={claudeGrassQuick5Controls.grassWidth}
          grassHeight={claudeGrassQuick5Controls.grassHeight}
          grassDensity={claudeGrassQuick5Controls.grassDensity}
          lodDistance={claudeGrassQuick5Controls.lodDistance}
          maxDistance={claudeGrassQuick5Controls.maxDistance}
          patchSize={claudeGrassQuick5Controls.patchSize}
          gridSize={claudeGrassQuick5Controls.gridSize}
          patchSpacing={claudeGrassQuick5Controls.patchSpacing}
          windEnabled={claudeGrassQuick5Controls.windEnabled}
          windStrength={claudeGrassQuick5Controls.windStrength}
          windDirectionScale={claudeGrassQuick5Controls.windDirectionScale}
          windDirectionSpeed={claudeGrassQuick5Controls.windDirectionSpeed}
          windStrengthScale={claudeGrassQuick5Controls.windStrengthScale}
          windStrengthSpeed={claudeGrassQuick5Controls.windStrengthSpeed}
          playerInteractionEnabled={
            claudeGrassQuick5Controls.playerInteractionEnabled
          }
          playerInteractionRepel={
            claudeGrassQuick5Controls.playerInteractionRepel
          }
          playerInteractionRange={
            claudeGrassQuick5Controls.playerInteractionRange
          }
          playerInteractionStrength={
            claudeGrassQuick5Controls.playerInteractionStrength
          }
          playerInteractionHeightThreshold={
            claudeGrassQuick5Controls.playerInteractionHeightThreshold
          }
          baseColor1={claudeGrassQuick5Controls.baseColor1}
          baseColor2={claudeGrassQuick5Controls.baseColor2}
          tipColor1={claudeGrassQuick5Controls.tipColor1}
          tipColor2={claudeGrassQuick5Controls.tipColor2}
          gradientCurve={claudeGrassQuick5Controls.gradientCurve}
          aoEnabled={claudeGrassQuick5Controls.aoEnabled}
          aoIntensity={claudeGrassQuick5Controls.aoIntensity}
          fogEnabled={claudeGrassQuick5Controls.fogEnabled}
          fogNear={claudeGrassQuick5Controls.fogNear}
          fogFar={claudeGrassQuick5Controls.fogFar}
          fogIntensity={claudeGrassQuick5Controls.fogIntensity}
          fogColor={claudeGrassQuick5Controls.fogColor}
          specularEnabled={claudeGrassQuick5Controls.specularEnabled}
          specularIntensity={claudeGrassQuick5Controls.specularIntensity}
          specularColor={claudeGrassQuick5Controls.specularColor}
          specularDirectionX={claudeGrassQuick5Controls.specularDirectionX}
          specularDirectionY={claudeGrassQuick5Controls.specularDirectionY}
          specularDirectionZ={claudeGrassQuick5Controls.specularDirectionZ}
          grassMiddleBrightnessMin={
            claudeGrassQuick5Controls.grassMiddleBrightnessMin
          }
          grassMiddleBrightnessMax={
            claudeGrassQuick5Controls.grassMiddleBrightnessMax
          }
          backscatterEnabled={claudeGrassQuick5Controls.backscatterEnabled}
          backscatterIntensity={claudeGrassQuick5Controls.backscatterIntensity}
          backscatterColor={claudeGrassQuick5Controls.backscatterColor}
          backscatterPower={claudeGrassQuick5Controls.backscatterPower}
          frontScatterStrength={claudeGrassQuick5Controls.frontScatterStrength}
          rimSSSStrength={claudeGrassQuick5Controls.rimSSSStrength}
        />
      )}

      {/* Lens Flares */}
      {lensFlareEnabled && (
        <>
          {lensFlare1Enabled && (
            <LensFlare
              position={[
                lensFlare1Position.x,
                lensFlare1Position.y,
                lensFlare1Position.z,
              ]}
              h={lensFlare1H}
              s={lensFlare1S}
              l={lensFlare1L}
              intensity={lensFlare1Intensity}
              distance={flareDistance}
            />
          )}
          {lensFlare2Enabled && (
            <LensFlare
              position={[
                lensFlare2Position.x,
                lensFlare2Position.y,
                lensFlare2Position.z,
              ]}
              h={lensFlare2H}
              s={lensFlare2S}
              l={lensFlare2L}
              intensity={lensFlare2Intensity}
              distance={flareDistance}
            />
          )}
          {lensFlare3Enabled && (
            <LensFlare
              position={[
                lensFlare3Position.x,
                lensFlare3Position.y,
                lensFlare3Position.z,
              ]}
              h={lensFlare3H}
              s={lensFlare3S}
              l={lensFlare3L}
              intensity={lensFlare3Intensity}
              distance={flareDistance}
            />
          )}
        </>
      )}
    </group>
  );
};

