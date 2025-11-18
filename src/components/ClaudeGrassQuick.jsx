import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Constants
const NUM_GRASS = 32 * 32 * 3; // 3072 blades per patch
const GRASS_SEGMENTS_LOW = 1;
const GRASS_SEGMENTS_HIGH = 6;
const GRASS_VERTICES_LOW = (GRASS_SEGMENTS_LOW + 1) * 2; // 4
const GRASS_VERTICES_HIGH = (GRASS_SEGMENTS_HIGH + 1) * 2; // 14
const GRASS_LOD_DIST = 15;
const GRASS_MAX_DIST = 100;
const GRASS_PATCH_SIZE = 5 * 2; // 10 units
const GRASS_WIDTH = 0.1;
const GRASS_HEIGHT = 1.5;

// Shader utility functions that will be prepended to both shaders
// Note: PI is already defined by Three.js <common>, so we don't define it here
const SHADER_COMMON = `
// Utility functions
float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

vec2 saturate2(vec2 x) {
  return clamp(x, vec2(0.0), vec2(1.0));
}

vec3 saturate3(vec3 x) {
  return clamp(x, vec3(0.0), vec3(1.0));
}

float linearstep(float minValue, float maxValue, float v) {
  return clamp((v - minValue) / (maxValue - minValue), 0.0, 1.0);
}

float inverseLerp(float minValue, float maxValue, float v) {
  return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  float t = inverseLerp(inMin, inMax, v);
  return mix(outMin, outMax, t);
}

float easeOut(float x, float t) {
  return 1.0 - pow(1.0 - x, t);
}

float easeIn(float x, float t) {
  return pow(x, t);
}

mat3 rotateX(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

mat3 rotateY(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
    );
}

mat3 rotateAxis(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;

  return mat3(
    oc * axis.x * axis.x + c, oc * axis.x * axis.y + axis.z * s, oc * axis.z * axis.x - axis.y * s,
    oc * axis.x * axis.y - axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.x + axis.y * s, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.z + c
  );
}

// Hash functions - GLSL 1.0 compatible (no uint types)
vec4 hash42(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(443.897, 441.423, 437.195, 429.123));
  p4 += dot(p4, p4.wzxy + 19.19);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash12(vec2 p) {
  return hash(p);
}

float noise12(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// OkLab color space
vec3 rgbToOklab(vec3 c) {
  mat3 kCONEtoLMS = mat3(
    0.4121656120, 0.5362752080, 0.0514575653,
    0.2118591070, 0.6807189584, 0.1074065790,
    0.0883097947, 0.2818474174, 0.6302613616
  );

  vec3 lms = kCONEtoLMS * c;
  return sign(lms) * pow(abs(lms), vec3(0.3333333333333));
}

vec3 oklabToRGB(vec3 c) {
  mat3 kLMStoCONE = mat3(
    4.0767245293, -3.3072168827, 0.2307590544,
    -1.2681437731, 2.6093323231, -0.3411344290,
    -0.0041119885, -0.7034763098, 1.7068625689
  );

  vec3 lms = c;
  return kLMStoCONE * (lms * lms * lms);
}

vec3 col3_rgb(float r, float g, float b) {
  return rgbToOklab(vec3(r, g, b));
}

vec3 col3_vec(vec3 v) {
  return rgbToOklab(v);
}

// Sky/Fog functions
vec3 CalculateSkyLighting(vec3 viewDir, vec3 normalDir) {
  vec3 SKY_lighterBlue = vec3(0.39, 0.57, 0.86) * 0.25;
  vec3 SKY_midBlue = vec3(0.1, 0.11, 0.1) * 0.5;
  vec3 SKY_darkerBlue = vec3(0.0);
  vec3 SKY_SUN_COLOUR = vec3(0.5);
  vec3 SKY_SUN_GLOW_COLOUR = vec3(0.15, 0.2, 0.25);
  vec3 SUN_DIR = vec3(-1.0, 0.45, 1.0);

  vec3 lighterBlue = col3_vec(SKY_lighterBlue);
  vec3 midBlue = col3_vec(SKY_midBlue);
  vec3 darkerBlue = col3_vec(SKY_darkerBlue);
  vec3 SUN_COLOUR = col3_vec(SKY_SUN_COLOUR);
  vec3 SUN_GLOW_COLOUR = col3_vec(SKY_SUN_GLOW_COLOUR);

  float viewDirY = linearstep(-0.01, 1.0, viewDir.y);
  vec3 skyGradient = mix(darkerBlue, lighterBlue, exp(-sqrt(saturate(viewDirY)) * 2.0));

  vec3 sunDir = normalize(SUN_DIR);
  float mu = 1.0 - saturate(dot(viewDir, sunDir));

  vec3 colour = skyGradient + SUN_GLOW_COLOUR * saturate(exp(-sqrt(mu) * 10.0)) * 0.75;
  colour += SUN_COLOUR * smoothstep(0.9997, 0.9998, 1.0 - mu);
  colour = oklabToRGB(colour);

  return colour;
}

vec3 CalculateSkyFog(vec3 normalDir) {
  return CalculateSkyLighting(normalDir, normalDir);
}

vec3 CalculateFog(vec3 baseColour, vec3 viewDir, float sceneDepth) {
  float SKY_fogScatterDensity = 0.0005;
  float SKY_fogExtinctionDensity = 0.003;

  vec3 fogSkyColour = CalculateSkyFog(-viewDir);
  float fogDepth = sceneDepth * sceneDepth;

  float fogScatterFactor = exp(-SKY_fogScatterDensity * SKY_fogScatterDensity * fogDepth);
  float fogExtinctionFactor = exp(-SKY_fogExtinctionDensity * SKY_fogExtinctionDensity * fogDepth);

  vec3 finalColour = baseColour * fogExtinctionFactor + fogSkyColour * (1.0 - fogScatterFactor);
  return finalColour;
}
`;

// Vertex Shader
const vertexShader = `
#define PHONG
varying vec3 vViewPosition;

${SHADER_COMMON}

#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

varying vec3 vWorldNormal;
varying vec3 vGrassColour;
varying vec4 vGrassParams;
varying vec3 vNormal2;
varying vec3 vWorldPosition;

uniform vec2 grassSize;
uniform vec4 grassParams;
uniform vec4 grassDraw;
uniform float time;
uniform sampler2D heightmap;
uniform vec4 heightParams;
uniform vec3 playerPos;
uniform mat4 viewMatrixInverse;

attribute float vertIndex;

void main() {
  #include <uv_vertex>
  #include <color_vertex>
  #include <morphcolor_vertex>
  #include <beginnormal_vertex>
  #include <begin_vertex>
  
  // Declare variables inline as we use them (like GrassClaude2)
  vec3 grassOffset;
  vec3 grassBladeWorldPos;
  vec2 heightmapUV;
  vec4 heightmapSample;
  float heightmapSampleHeight;
  vec4 hashVal1;
  float highLODOut;
  float lodFadeIn;
  float isSandy;
  float grassAllowedHash;
  float isGrassAllowed;
  float randomAngle;
  float randomShade;
  float randomHeight;
  float randomWidth;
  float randomLean;
  vec2 hashGrassColour;
  float leanAnimation;
  float GRASS_SEGMENTS;
  float GRASS_VERTICES;
  float vertID;
  float zSide;
  float xSide;
  float heightPercent;
  float grassTotalHeight;
  float grassTotalWidthHigh;
  float grassTotalWidthLow;
  float grassTotalWidth;
  float x;
  float y;
  float windDir;
  float windNoiseSample;
  float windLeanAngle;
  vec3 windAxis;
  float distToPlayer;
  float playerFalloff;
  float playerLeanAngle;
  vec3 grassToPlayer;
  vec3 playerLeanAxis;
  float easedHeight;
  float curveAmount;
  float ncurve1;
  vec3 n1;
  float ncurve2;
  vec3 n2;
  vec3 ncurve;
  mat3 grassMat;
  vec3 grassFaceNormal;
  vec3 grassVertexNormal;
  vec3 grassVertexNormal1;
  vec3 grassVertexNormal2;
  vec3 grassVertexPosition;
  vec3 b1;
  vec3 b2;
  vec3 t1;
  vec3 t2;
  vec3 baseColour;
  vec3 tipColour;
  vec3 highLODColour;
  vec3 lowLODColour;
  float SKY_RATIO;
  vec3 UP;
  float skyFadeIn;
  vec3 normal1;
  vec3 normal2;
  // transformed is declared by <begin_vertex>, don't redeclare it
  vec3 viewDir;
  vec3 viewDirXZ;
  vec3 grassFaceNormalXZ;
  float viewDotNormal;
  float viewSpaceThickenFactor;
  
  // Now execute the code
  grassOffset = vec3(position.x, 0.0, position.y);

  // Blade world position
  grassBladeWorldPos = (modelMatrix * vec4(grassOffset, 1.0)).xyz;
  heightmapUV = vec2(
      remap(grassBladeWorldPos.x, -heightParams.x * 0.5, heightParams.x * 0.5, 0.0, 1.0),
      remap(grassBladeWorldPos.z, -heightParams.x * 0.5, heightParams.x * 0.5, 1.0, 0.0));
  heightmapSample = texture2D(heightmap, heightmapUV);
  grassBladeWorldPos.y += heightmapSample.x * grassParams.z - grassParams.w;

  heightmapSampleHeight = 1.0;

  hashVal1 = hash42(vec2(grassBladeWorldPos.x, grassBladeWorldPos.z));

  highLODOut = smoothstep(grassDraw.x * 0.5, grassDraw.x, distance(cameraPosition, grassBladeWorldPos));
  lodFadeIn = smoothstep(grassDraw.x, grassDraw.y, distance(cameraPosition, grassBladeWorldPos));

  // Check terrain type
  isSandy = linearstep(-11.0, -14.0, grassBladeWorldPos.y);
  grassAllowedHash = hashVal1.w - isSandy;
  isGrassAllowed = step(0.0, grassAllowedHash);

  randomAngle = hashVal1.x * 2.0 * PI;
  randomShade = remap(hashVal1.y, -1.0, 1.0, 0.5, 1.0);
  randomHeight = remap(hashVal1.z, 0.0, 1.0, 0.75, 1.5) * mix(1.0, 0.0, lodFadeIn) * isGrassAllowed * heightmapSampleHeight;
  randomWidth = (1.0 - isSandy) * heightmapSampleHeight;
  randomLean = remap(hashVal1.w, 0.0, 1.0, 0.1, 0.4);

  hashGrassColour = hash22(vec2(grassBladeWorldPos.x, grassBladeWorldPos.z));
  leanAnimation = noise12(vec2(time * 0.35) + grassBladeWorldPos.xz * 137.423) * 0.1;

  GRASS_SEGMENTS = grassParams.x;
  GRASS_VERTICES = grassParams.y;

  // Figure out vertex id
  vertID = mod(float(vertIndex), GRASS_VERTICES);

  // 1 = front, -1 = back
  zSide = -(floor(vertIndex / GRASS_VERTICES) * 2.0 - 1.0);

  // 0 = left, 1 = right
  xSide = mod(vertID, 2.0);

  heightPercent = (vertID - xSide) / (GRASS_SEGMENTS * 2.0);

  grassTotalHeight = grassSize.y * randomHeight;
  grassTotalWidthHigh = easeOut(1.0 - heightPercent, 2.0);
  grassTotalWidthLow = 1.0 - heightPercent;
  grassTotalWidth = grassSize.x * mix(grassTotalWidthHigh, grassTotalWidthLow, highLODOut) * randomWidth;

  // Shift verts
  x = (xSide - 0.5) * grassTotalWidth;
  y = heightPercent * grassTotalHeight;

  // Wind
  windDir = noise12(grassBladeWorldPos.xz * 0.05 + 0.05 * time);
  windNoiseSample = noise12(grassBladeWorldPos.xz * 0.25 + time * 1.0);
  windLeanAngle = remap(windNoiseSample, -1.0, 1.0, 0.25, 1.0);
  windLeanAngle = easeIn(windLeanAngle, 2.0) * 1.25;
  windAxis = vec3(cos(windDir), 0.0, sin(windDir));
  windLeanAngle *= heightPercent;

  // Player interaction
  distToPlayer = distance(grassBladeWorldPos.xz, playerPos.xz);
  playerFalloff = smoothstep(2.5, 1.0, distToPlayer);
  playerLeanAngle = mix(0.0, 0.2, playerFalloff * linearstep(0.5, 0.0, windLeanAngle));
  grassToPlayer = normalize(vec3(playerPos.x, 0.0, playerPos.z) - vec3(grassBladeWorldPos.x, 0.0, grassBladeWorldPos.z));
  playerLeanAxis = vec3(grassToPlayer.z, 0.0, -grassToPlayer.x);

  randomLean += leanAnimation;

  easedHeight = mix(easeIn(heightPercent, 2.0), 1.0, highLODOut);
  curveAmount = -randomLean * easedHeight;

  // Normal calculation
  ncurve1 = -randomLean * easedHeight;
  n1 = vec3(0.0, (heightPercent + 0.01), 0.0);
  n1 = rotateX(ncurve1) * n1;

  ncurve2 = -randomLean * easedHeight * 0.9;
  n2 = vec3(0.0, (heightPercent + 0.01) * 0.9, 0.0);
  n2 = rotateX(ncurve2) * n2;

  ncurve = normalize(n1 - n2);

  grassMat = rotateAxis(playerLeanAxis, playerLeanAngle) * rotateAxis(windAxis, windLeanAngle) * rotateY(randomAngle);

  grassFaceNormal = vec3(0.0, 0.0, 1.0);
  grassFaceNormal = grassMat * grassFaceNormal;
  grassFaceNormal *= zSide;

  grassVertexNormal = vec3(0.0, -ncurve.z, ncurve.y);
  grassVertexNormal1 = rotateY(PI * 0.3 * zSide) * grassVertexNormal;
  grassVertexNormal2 = rotateY(PI * -0.3 * zSide) * grassVertexNormal;

  grassVertexNormal1 = grassMat * grassVertexNormal1;
  grassVertexNormal1 *= zSide;

  grassVertexNormal2 = grassMat * grassVertexNormal2;
  grassVertexNormal2 *= zSide;

  grassVertexPosition = vec3(x, y, 0.0);
  grassVertexPosition = rotateX(curveAmount) * grassVertexPosition;
  grassVertexPosition = grassMat * grassVertexPosition;
  grassVertexPosition += grassOffset;

  // Color gradient
  b1 = vec3(0.02, 0.075, 0.01);
  b2 = vec3(0.025, 0.1, 0.01);
  t1 = vec3(0.65, 0.8, 0.25);
  t2 = vec3(0.8, 0.9, 0.4);

  baseColour = mix(b1, b2, hashGrassColour.x);
  tipColour = mix(t1, t2, hashGrassColour.y);
  highLODColour = mix(baseColour, tipColour, easeIn(heightPercent, 4.0)) * randomShade;
  lowLODColour = mix(b1, t1, heightPercent);
  vGrassColour = mix(highLODColour, lowLODColour, highLODOut);
  vGrassParams = vec4(heightPercent, grassBladeWorldPos.y, highLODOut, xSide);

  SKY_RATIO = 0.25;
  UP = vec3(0.0, 1.0, 0.0);
  skyFadeIn = (1.0 - highLODOut) * SKY_RATIO;
  normal1 = normalize(mix(UP, grassVertexNormal1, skyFadeIn));
  normal2 = normalize(mix(UP, grassVertexNormal2, skyFadeIn));

  transformed = grassVertexPosition;
  transformed.y += grassBladeWorldPos.y;

  viewDir = normalize(cameraPosition - grassBladeWorldPos);
  viewDirXZ = normalize(vec3(viewDir.x, 0.0, viewDir.z));
  grassFaceNormalXZ = normalize(vec3(grassFaceNormal.x, 0.0, grassFaceNormal.z));

  viewDotNormal = saturate(dot(grassFaceNormal, viewDirXZ));
  viewSpaceThickenFactor = easeOut(1.0 - viewDotNormal, 4.0) * smoothstep(0.0, 0.2, viewDotNormal);

  // Set objectNormal before normal processing includes
  objectNormal = grassVertexNormal1;

  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <normal_vertex>

  vNormal = normalize(normalMatrix * normal1);
  vNormal2 = normalize(normalMatrix * normal2);

  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>

  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  mvPosition = modelViewMatrix * mvPosition;

  // Billboard thickening in view space
  mvPosition.x += viewSpaceThickenFactor * (xSide - 0.5) * grassTotalWidth * 0.5 * zSide;

  gl_Position = projectionMatrix * mvPosition;

  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = -mvPosition.xyz;
  #include <worldpos_vertex>
  #include <envmap_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>

  // Calculate world position manually (worldPosition from worldpos_vertex might not be accessible)
  vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
}
`;

// Fragment Shader
const fragmentShader = `
#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;

#include <common>

varying vec3 vGrassColour;
varying vec4 vGrassParams;
varying vec3 vNormal2;
varying vec3 vWorldPosition;
// vViewPosition is provided by Three.js shader chunks, don't declare it

#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

uniform sampler2D grassTexture;
uniform vec3 grassLODColour;
uniform float time;
uniform mat3 normalMatrix;

// Utility functions
// Note: saturate might be defined by Three.js, so we check and undefine if needed
#ifdef saturate
#undef saturate
#endif
float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

float linearstep(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float easeIn(float t, float p) {
  return pow(t, p);
}

// OkLab color space functions for fog
vec3 rgbToOklab(vec3 c) {
  mat3 kCONEtoLMS = mat3(
    0.4121656120, 0.5362752080, 0.0514575653,
    0.2118591070, 0.6807189584, 0.1074065790,
    0.0883097947, 0.2818474174, 0.6302613616
  );
  vec3 lms = kCONEtoLMS * c;
  return sign(lms) * pow(abs(lms), vec3(0.3333333333333));
}

vec3 oklabToRGB(vec3 c) {
  mat3 kLMStoCONE = mat3(
    4.0767245293, -3.3072168827, 0.2307590544,
    -1.2681437731, 2.6093323231, -0.3411344290,
    -0.0041119885, -0.7034763098, 1.7068625689
  );
  vec3 lms = c;
  return kLMStoCONE * (lms * lms * lms);
}

vec3 col3_vec(vec3 v) {
  return rgbToOklab(v);
}

// Sky/Fog functions
vec3 CalculateSkyLighting(vec3 viewDir, vec3 normalDir) {
  vec3 SKY_lighterBlue = vec3(0.39, 0.57, 0.86) * 0.25;
  vec3 SKY_midBlue = vec3(0.1, 0.11, 0.1) * 0.5;
  vec3 SKY_darkerBlue = vec3(0.0);
  vec3 SKY_SUN_COLOUR = vec3(0.5);
  vec3 SKY_SUN_GLOW_COLOUR = vec3(0.15, 0.2, 0.25);
  vec3 SUN_DIR = vec3(-1.0, 0.45, 1.0);

  vec3 lighterBlue = col3_vec(SKY_lighterBlue);
  vec3 midBlue = col3_vec(SKY_midBlue);
  vec3 darkerBlue = col3_vec(SKY_darkerBlue);
  vec3 SUN_COLOUR = col3_vec(SKY_SUN_COLOUR);
  vec3 SUN_GLOW_COLOUR = col3_vec(SKY_SUN_GLOW_COLOUR);

  float viewDirY = linearstep(-0.01, 1.0, viewDir.y);
  vec3 skyGradient = mix(darkerBlue, lighterBlue, exp(-sqrt(saturate(viewDirY)) * 2.0));

  vec3 sunDir = normalize(SUN_DIR);
  float mu = 1.0 - saturate(dot(viewDir, sunDir));

  vec3 colour = skyGradient + SUN_GLOW_COLOUR * saturate(exp(-sqrt(mu) * 10.0)) * 0.75;
  colour += SUN_COLOUR * smoothstep(0.9997, 0.9998, 1.0 - mu);
  colour = oklabToRGB(colour);

  return colour;
}

vec3 CalculateSkyFog(vec3 normalDir) {
  return CalculateSkyLighting(normalDir, normalDir);
}

vec3 CalculateFog(vec3 baseColour, vec3 viewDir, float sceneDepth) {
  float SKY_fogScatterDensity = 0.0005;
  float SKY_fogExtinctionDensity = 0.003;

  vec3 fogSkyColour = CalculateSkyFog(-viewDir);
  float fogDepth = sceneDepth * sceneDepth;

  float fogScatterFactor = exp(-SKY_fogScatterDensity * SKY_fogScatterDensity * fogDepth);
  float fogExtinctionFactor = exp(-SKY_fogExtinctionDensity * SKY_fogExtinctionDensity * fogDepth);

  vec3 finalColour = baseColour * fogExtinctionFactor + fogSkyColour * (1.0 - fogScatterFactor);
  return finalColour;
}

void main() {
  // Declare ALL variables at the top
  vec3 viewDir;
  vec4 diffuseColor;
  float heightPercent;
  float height;
  float lodFadeIn;
  float lodFadeOut;
  float grassMiddle;
  float isSandy;
  float density;
  float aoForDensity;
  float ao;
  ReflectedLight reflectedLight;
  vec3 totalEmissiveRadiance;
  vec3 normal2;
  // baseNormal will be declared inline where it's used
  vec3 outgoingLight;
  float sceneDepth;
  
  // Now execute code
  viewDir = normalize(cameraPosition - vWorldPosition);

  #include <clipping_planes_fragment>
  
  diffuseColor = vec4(diffuse, opacity);

  // Grass
  heightPercent = vGrassParams.x;
  height = vGrassParams.y;
  lodFadeIn = vGrassParams.z;
  lodFadeOut = 1.0 - lodFadeIn;

  grassMiddle = mix(smoothstep(abs(vGrassParams.w - 0.5), 0.0, 0.1), 1.0, lodFadeIn);

  isSandy = saturate(linearstep(-11.0, -14.0, height));

  density = 1.0 - isSandy;

  aoForDensity = mix(1.0, 0.25, density);
  ao = mix(aoForDensity, 1.0, easeIn(heightPercent, 2.0));

  diffuseColor.rgb *= vGrassColour;
  diffuseColor.rgb *= mix(0.85, 1.0, grassMiddle);
  diffuseColor.rgb *= ao;

  reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
  totalEmissiveRadiance = emissive;
  
  #include <logdepthbuf_fragment>
  #include <map_fragment>
  #include <color_fragment>
  #include <alphamap_fragment>
  #include <alphatest_fragment>
  #include <alphahash_fragment>
  #include <specularmap_fragment>
  #include <normal_fragment_begin>
  #include <normal_fragment_maps>

  // Mix normals for more 3D appearance - using normal (from Three.js) and vNormal2 (custom)
  // normal is already provided by Three.js after normal_fragment_maps
  // Use a different variable name to avoid conflicts with Three.js
  vec3 grassBaseNormal = normalize(normal);
  normal2 = normalize(vNormal2);
  normal = normalize(mix(grassBaseNormal, normal2, vGrassParams.w));

  #include <emissivemap_fragment>
  
  #include <lights_phong_fragment>
  #include <lights_fragment_begin>
  #include <lights_fragment_maps>
  #include <lights_fragment_end>
  #include <aomap_fragment>
  
  outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;

  #include <envmap_fragment>
  #include <opaque_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  // Calculate fog with proper depth
  sceneDepth = length(vViewPosition);
  gl_FragColor.xyz = CalculateFog(gl_FragColor.xyz, viewDir, sceneDepth);

  #include <premultiplied_alpha_fragment>
  #include <dithering_fragment>
}
`;

// Custom Float16 Buffer Attribute (for memory optimization)
class InstancedFloat16BufferAttribute extends THREE.InstancedBufferAttribute {
  constructor(array, itemSize, normalized = false, meshPerAttribute = 1) {
    super(new Uint16Array(array), itemSize, normalized, meshPerAttribute);
    this.isFloat16BufferAttribute = true;
  }
}

// Seeded random for consistent grass placement
let seed = 0;
function setSeed(s) {
  seed = s;
}

function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function randRange(min, max) {
  return min + random() * (max - min);
}

// Create geometry for grass
function createGrassGeometry(segments) {
  setSeed(0);

  const VERTICES = (segments + 1) * 2;

  // Create indices for front and back faces
  const indices = [];
  for (let i = 0; i < segments; ++i) {
    const vi = i * 2;
    // Front face
    indices.push(vi + 0, vi + 1, vi + 2);
    indices.push(vi + 2, vi + 1, vi + 3);

    // Back face
    const fi = VERTICES + vi;
    indices.push(fi + 2, fi + 1, fi + 0);
    indices.push(fi + 3, fi + 1, fi + 2);
  }

  // Create random offsets for each blade within patch
  const offsets = [];
  for (let i = 0; i < NUM_GRASS; ++i) {
    offsets.push(randRange(-GRASS_PATCH_SIZE * 0.5, GRASS_PATCH_SIZE * 0.5));
    offsets.push(randRange(-GRASS_PATCH_SIZE * 0.5, GRASS_PATCH_SIZE * 0.5));
    offsets.push(0);
  }

  // Convert to Float16 for memory efficiency
  const offsetsData = offsets.map(THREE.DataUtils.toHalfFloat);

  // Vertex indices
  const vertID = new Uint8Array(VERTICES * 2);
  for (let i = 0; i < VERTICES * 2; ++i) {
    vertID[i] = i;
  }

  const geo = new THREE.InstancedBufferGeometry();
  geo.instanceCount = NUM_GRASS;
  geo.setAttribute("vertIndex", new THREE.Uint8BufferAttribute(vertID, 1));
  geo.setAttribute(
    "position",
    new InstancedFloat16BufferAttribute(offsetsData, 3)
  );
  geo.setIndex(indices);
  geo.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, 0, 0),
    1 + GRASS_PATCH_SIZE * 2
  );

  return geo;
}

// Create heightmap texture (simple flat plane for now)
function createHeightmap() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    const stride = i * 4;
    data[stride] = 0; // Height
    data[stride + 1] = 0;
    data[stride + 2] = 0;
    data[stride + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;

  return texture;
}

// Main component
export default function ClaudeGrassFixed({
  playerPosition = new THREE.Vector3(0, 0, 0),
  terrainSize = 100,
  heightScale = 1,
  heightOffset = 0,
  grassWidth = 0.1,
  grassHeight = 1.5,
  lodDistance = 15,
  maxDistance = 100,
  patchSize = 10,
}) {
  const groupRef = useRef();
  const { camera } = useThree();

  // Create geometries and materials ONCE - never recreate them
  const { geometryLow, geometryHigh, materialLow, materialHigh, heightmap } =
    useMemo(() => {
      const geoLow = createGrassGeometry(GRASS_SEGMENTS_LOW);
      const geoHigh = createGrassGeometry(GRASS_SEGMENTS_HIGH);
      const hmap = createHeightmap();

      const createMaterial = (segments, vertices) => {
        const mat = new THREE.MeshPhongMaterial({
          color: 0x00ff00,
          side: THREE.FrontSide,
        });

        mat.onBeforeCompile = (shader) => {
          shader.uniforms.grassSize = {
            value: new THREE.Vector2(GRASS_WIDTH, GRASS_HEIGHT),
          };
          shader.uniforms.grassParams = {
            value: new THREE.Vector4(
              segments,
              vertices,
              1, // heightScale - will be updated via useEffect
              0  // heightOffset - will be updated via useEffect
            ),
          };
          shader.uniforms.grassDraw = {
            value: new THREE.Vector4(GRASS_LOD_DIST, GRASS_MAX_DIST, 0, 0),
          };
          shader.uniforms.time = { value: 0.0 };
          shader.uniforms.heightmap = { value: hmap };
          shader.uniforms.heightParams = {
            value: new THREE.Vector4(100, 0, 0, 0), // terrainSize - will be updated via useEffect
          };
          shader.uniforms.playerPos = { value: new THREE.Vector3(0, 0, 0) };
          shader.uniforms.viewMatrixInverse = { value: new THREE.Matrix4() };

          // Replace shaders with complete versions
          shader.vertexShader = vertexShader;
          shader.fragmentShader = fragmentShader;

          // Store reference for updates
          mat.userData.shader = shader;
        };

        mat.needsUpdate = true;

        return mat;
      };

      const matLow = createMaterial(GRASS_SEGMENTS_LOW, GRASS_VERTICES_LOW);
      const matHigh = createMaterial(GRASS_SEGMENTS_HIGH, GRASS_VERTICES_HIGH);

      return {
        geometryLow: geoLow,
        geometryHigh: geoHigh,
        materialLow: matLow,
        materialHigh: matHigh,
        heightmap: hmap,
      };
    }, []); // Empty dependencies - create only once!

  // Mesh pools
  const meshPoolLow = useRef([]);
  const meshPoolHigh = useRef([]);
  const totalTime = useRef(0);

  // Update function
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    totalTime.current += delta;

    // Update shader uniforms
    if (materialLow.userData.shader) {
      materialLow.userData.shader.uniforms.time.value = totalTime.current;
      materialLow.userData.shader.uniforms.playerPos.value = playerPosition;
      materialLow.userData.shader.uniforms.viewMatrixInverse.value =
        camera.matrixWorld;
      // Update control-based uniforms
      materialLow.userData.shader.uniforms.grassSize.value.set(grassWidth, grassHeight);
      materialLow.userData.shader.uniforms.grassParams.value.z = heightScale;
      materialLow.userData.shader.uniforms.grassParams.value.w = heightOffset;
      materialLow.userData.shader.uniforms.grassDraw.value.set(lodDistance, maxDistance, 0, 0);
      materialLow.userData.shader.uniforms.heightParams.value.x = terrainSize;
    }
    if (materialHigh.userData.shader) {
      materialHigh.userData.shader.uniforms.time.value = totalTime.current;
      materialHigh.userData.shader.uniforms.playerPos.value = playerPosition;
      materialHigh.userData.shader.uniforms.viewMatrixInverse.value =
        camera.matrixWorld;
      // Update control-based uniforms
      materialHigh.userData.shader.uniforms.grassSize.value.set(grassWidth, grassHeight);
      materialHigh.userData.shader.uniforms.grassParams.value.z = heightScale;
      materialHigh.userData.shader.uniforms.grassParams.value.w = heightOffset;
      materialHigh.userData.shader.uniforms.grassDraw.value.set(lodDistance, maxDistance, 0, 0);
      materialHigh.userData.shader.uniforms.heightParams.value.x = terrainSize;
    }

    // Frustum culling setup
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // Calculate base cell position
    const baseCellPos = camera.position.clone();
    baseCellPos.divideScalar(GRASS_PATCH_SIZE);
    baseCellPos.floor();
    baseCellPos.multiplyScalar(GRASS_PATCH_SIZE);

    // Hide all meshes
    groupRef.current.children.forEach((child) => {
      child.visible = false;
    });

    const meshesLowAvailable = [...meshPoolLow.current];
    const meshesHighAvailable = [...meshPoolHigh.current];

    const cameraPosXZ = new THREE.Vector3(
      camera.position.x,
      0,
      camera.position.z
    );
    const aabbTmp = new THREE.Box3();

    // Grid of patches around camera
    for (let x = -16; x < 16; x++) {
      for (let z = -16; z < 16; z++) {
        const currentCell = new THREE.Vector3(
          baseCellPos.x + x * GRASS_PATCH_SIZE,
          0,
          baseCellPos.z + z * GRASS_PATCH_SIZE
        );

        aabbTmp.setFromCenterAndSize(
          currentCell,
          new THREE.Vector3(GRASS_PATCH_SIZE, 1000, GRASS_PATCH_SIZE)
        );

        const distToCell = aabbTmp.distanceToPoint(cameraPosXZ);

        // Distance culling
        if (distToCell > GRASS_MAX_DIST) continue;

        // Frustum culling
        if (!frustum.intersectsBox(aabbTmp)) continue;

        // LOD selection
        const useLowLOD = distToCell > GRASS_LOD_DIST;
        const meshPool = useLowLOD ? meshesLowAvailable : meshesHighAvailable;
        const geo = useLowLOD ? geometryLow : geometryHigh;
        const mat = useLowLOD ? materialLow : materialHigh;

        let mesh;
        if (meshPool.length > 0) {
          mesh = meshPool.pop();
        } else {
          // Create new mesh if pool is empty
          mesh = new THREE.Mesh(geo, mat);
          mesh.receiveShadow = true;
          mesh.castShadow = false;
          groupRef.current.add(mesh);

          if (useLowLOD) {
            meshPoolLow.current.push(mesh);
          } else {
            meshPoolHigh.current.push(mesh);
          }
        }

        mesh.position.copy(currentCell);
        mesh.position.y = 0;
        mesh.visible = true;
      }
    }
  });

  return <group ref={groupRef} />;
}
