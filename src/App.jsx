import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import { Perf } from "r3f-perf";
import * as THREE from "three";

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "run", keys: ["Shift"] },
  { name: "jump", keys: ["Space"] },
  { name: "crouch", keys: ["ControlLeft", "ControlRight"] },
  { name: "dance", keys: ["KeyE"] },
  { name: "walkBackward", keys: ["KeyQ"] },
  { name: "roll", keys: ["KeyF"] },
];

function App() {
  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows
        camera={{ position: [3, 3, 3], near: 0.1, fov: 40, far: 10000 }}
        gl={{
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{
          touchAction: "none",
        }}
      >
        <Perf position="top-left" />
        <Experience />
      </Canvas>
    </KeyboardControls>
  );
}

export default App;
