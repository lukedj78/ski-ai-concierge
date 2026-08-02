"use client";

import { Canvas } from "@react-three/fiber";
import { type ReactNode, Suspense, useEffect, useState } from "react";

/**
 * La scena: luci, camera a mezza figura, sfondo.
 *
 * L'inquadratura e' il modo in cui si ottiene la mezza figura — la camera sta
 * all'altezza del busto e taglia sotto la vita. Non si taglia la mesh: un
 * modello mutilato si vede appena si muove.
 */
export function AvatarCanvas({ children }: { children: ReactNode }) {
  // Si parte dando per buono il WebGL, perche' il server non puo' saperlo e
  // due render diversi romperebbero l'idratazione. La verifica gira una volta
  // sola dopo il montaggio e, se il browser non lo supporta, si degrada.
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    if (!detectWebGL()) setHasWebGL(false);
  }, []);

  if (!hasWebGL) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-[15px] text-on-surface-variant">
          Questo browser non supporta la grafica 3D: il concierge risponde lo
          stesso, solo senza avatar.
        </p>
      </div>
    );
  }

  return (
    <Canvas
      // La mezza figura si ottiene inquadrando, non tagliando la mesh.
      //
      // I modelli riggati vengono allineati con l'osso della testa a quota
      // zero (vedi Avatar3D). Con fov 30 e distanza 1.95 l'altezza visibile e'
      // circa un metro: abbassando la camera a -0.34 la porzione inquadrata va
      // da poco sopra la testa fino alla vita. Cambiare uno di questi tre
      // numeri significa cambiare l'inquadratura, non la posa.
      camera={{ position: [0, -0.34, 1.95], fov: 30 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      className="h-full w-full"
    >
      {/* Luce da neve: forte dall'alto, di rimbalzo dal basso. */}
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 3, 2]} intensity={1.4} />
      <directionalLight
        position={[-2, -1, 1]}
        intensity={0.35}
        color="#bcd8ea"
      />
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
