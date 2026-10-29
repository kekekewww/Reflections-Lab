import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { LabController } from "../contracts.js";

// Keep the event payload stable. Viewport localizes this known raw diagnostic
// when rendering, so locale changes never tear down WebGL listeners.
const contextLostMessage = "WebGL 顯示已中斷；已暫停運算。畫面恢復後請明示繼續。";

export function ContextMonitor({
  controller,
  onError,
}: {
  controller: LabController;
  onError: (message: string | null) => void;
}) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onError(contextLostMessage);
      void controller.dispatch({ type: "pause" });
      void controller.dispatch({ type: "inputBlur" });
    };
    const restored = () => onError(null);
    gl.domElement.addEventListener("webglcontextlost", lost);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    return () => {
      gl.domElement.removeEventListener("webglcontextlost", lost);
      gl.domElement.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, controller, onError]);
  return null;
}
