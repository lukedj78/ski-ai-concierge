"use client";

import { type VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Box3, type Group, type Mesh, type Object3D, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AvatarFallbackBoundary } from "./AvatarFallbackBoundary";
import { idleMotion } from "./animations/idle";
import {
  CLOSED_MOUTH,
  damp,
  dampWeights,
  VISEMES,
  type VisemeWeights,
} from "./animations/lipSync";
import type { AvatarState } from "./AvatarState";

export type Avatar3DProps = {
  /** Lo stato: e' l'unico dato che arriva dal mondo esterno. */
  state: AvatarState;
  /**
   * Riferimento mutabile ai pesi dei visemi, stimati dalle formanti: dicono
   * *quale* vocale, non solo quanto e' aperta la bocca. Si legge a ogni frame.
   */
  visemes?: { current: VisemeWeights };
  /** URL del modello, `.glb` o `.vrm`.  */
  vrmUrl: string | null;
};

/**
 * La figura del maestro di sci.
 *
 * Non sa niente di eve, di modelli AI, di database o di prenotazioni: riceve
 * uno stato e un'ampiezza e li mette in scena. Se un giorno l'orchestratore
 * cambiasse, questo file non se ne accorgerebbe.
 */
export function Avatar3D({ state, visemes, vrmUrl }: Avatar3DProps) {
  const mouth = visemes ?? { current: CLOSED_MOUTH };

  // Nessun ripiego disegnato: o c'e' il modello, o la scena resta vuota. Una
  // figura di riserva che compare al primo caricamento fallito e non se ne va
  // piu' e' peggio del vuoto.
  if (!vrmUrl) return null;

  // Due formati, due strade. `.vrm` porta con se' le espressioni standard;
  // un `.glb` realistico (Ready Player Me, Avaturn, un modello proprio) porta
  // i morph target ARKit e i visemi Oculus. Il resto dell'interfaccia non
  // vede la differenza.
  const isVrm = vrmUrl.split("?")[0]?.toLowerCase().endsWith(".vrm") ?? false;

  return (
    <AvatarFallbackBoundary fallback={null}>
      {isVrm ? (
        <VrmFigure url={vrmUrl} state={state} mouth={mouth} />
      ) : (
        <GlbFigure url={vrmUrl} state={state} mouth={mouth} />
      )}
    </AvatarFallbackBoundary>
  );
}

function VrmFigure({
  url,
  state,
  mouth,
}: {
  url: string;
  state: AvatarState;
  mouth: { current: VisemeWeights };
}) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  const vrm = useMemo(() => {
    const loaded = gltf.userData.vrm as VRM | undefined;
    if (!loaded) return null;
    // I VRM 0.x guardano nella direzione opposta rispetto ai VRM 1.0.
    VRMUtils.rotateVRM0(loaded);
    // Le parti non visibili in mezza figura restano fuori dal frustum culling.
    VRMUtils.removeUnnecessaryJoints(loaded.scene);
    return loaded;
  }, [gltf]);

  const smoothed = useRef<VisemeWeights>({ ...CLOSED_MOUTH });

  useFrame((_, delta) => {
    if (!vrm) return;

    const time = performance.now() / 1000;
    const motion = idleMotion(time, state);

    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    if (head) {
      head.rotation.y = motion.headYaw;
      head.rotation.x = motion.headPitch;
    }
    vrm.scene.position.y = motion.breath;

    // La bocca segue l'audio solo mentre parla: in ascolto o in attesa i pesi
    // residui la farebbero muovere a vuoto.
    const target = state === "speaking" ? mouth.current : CLOSED_MOUTH;
    smoothed.current = dampWeights(smoothed.current, target);

    // I nomi dei visemi VRM coincidono con i nostri.
    for (const viseme of VISEMES) {
      vrm.expressionManager?.setValue(viseme, smoothed.current[viseme]);
    }
    // Un accenno di sorriso quando ascolta: e' il segnale che sta ricevendo.
    vrm.expressionManager?.setValue(
      "happy",
      state === "listening" ? 0.25 : 0.05,
    );

    vrm.update(delta);
  });

  if (!vrm) return null;
  return <primitive object={vrm.scene} />;
}

/**
 * Il modello realistico in formato GLB.
 *
 * Regge i morph target ARKit (`jawOpen`, `mouthSmile*`) e i visemi Oculus
 * (`viseme_aa`, `viseme_O`, ...): sono quelli che esportano Ready Player Me,
 * Avaturn e la maggior parte delle pipeline di avatar fotorealistici. Se il
 * modello ne ha solo una parte, si usa quello che c'e' — non si rompe niente.
 */
/** Dai nostri visemi a quelli Oculus, che sono lo standard nei GLB. */
const OCULUS_VISEME: Record<(typeof VISEMES)[number], string> = {
  aa: "viseme_aa",
  ih: "viseme_I",
  ou: "viseme_U",
  ee: "viseme_E",
  oh: "viseme_O",
};

function GlbFigure({
  url,
  state,
  mouth,
}: {
  url: string;
  state: AvatarState;
  mouth: { current: VisemeWeights };
}) {
  const gltf = useLoader(GLTFLoader, url);
  const smoothed = useRef<VisemeWeights>({ ...CLOSED_MOUTH });

  const rig = useMemo(() => {
    const morphMeshes: Mesh[] = [];
    gltf.scene.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary) morphMeshes.push(mesh);
    });

    const head =
      gltf.scene.getObjectByName("Head") ??
      gltf.scene.getObjectByName("head") ??
      null;

    // I nomi dei blendshape non sono standardizzati fuori da ARKit e dai
    // visemi Oculus: se non se ne riconosce nessuno, si cerca qualcosa che
    // apra la bocca. Meglio un lip sync approssimativo di una bocca ferma.
    const known = ["viseme_aa", "jawOpen", "mouthOpen"];
    const dictionaries = morphMeshes.map((mesh) => mesh.morphTargetDictionary);
    const hasKnown = dictionaries.some((dictionary) =>
      known.some((name) => dictionary && name in dictionary),
    );
    const discovered = hasKnown
      ? null
      : (dictionaries
          .flatMap((dictionary) => Object.keys(dictionary ?? {}))
          .find((name) => /jaw|mouth.*open|open.*mouth/i.test(name)) ?? null);

    // Ultima risorsa: l'osso della mandibola. I modelli riggati senza shape
    // key — quelli che escono da MakeHuman, da Mixamo, da molte pipeline di
    // scansione — hanno comunque un osso che apre la bocca. Ruotarlo non e'
    // elegante quanto un viseme, ma e' la differenza fra una bocca che si
    // muove e una faccia di cera.
    let jawBone: Object3D | null = null;
    if (!hasKnown && !discovered) {
      gltf.scene.traverse((node) => {
        if (!jawBone && /jaw|chin|mandib/i.test(node.name)) jawBone = node;
      });
    }
    const jawRestX = (jawBone as Object3D | null)?.rotation.x ?? 0;

    return {
      morphMeshes,
      head,
      discovered,
      jawBone: jawBone as Object3D | null,
      jawRestX,
    };
  }, [gltf]);

  function setMorph(name: string, value: number) {
    for (const mesh of rig.morphMeshes) {
      const index = mesh.morphTargetDictionary?.[name];
      if (index === undefined || !mesh.morphTargetInfluences) continue;
      mesh.morphTargetInfluences[index] = value;
    }
  }

  // L'inquadratura si misura al primo frame utile, non nel `useMemo`: li' le
  // matrici del mondo possono non essere ancora aggiornate, e una misura presa
  // troppo presto mette la testa fuori campo — il sintomo e' un avatar di cui
  // si vedono solo i piedi.
  const framing = useRef<{ offsetY: number; scale: number } | null>(null);

  useFrame(() => {
    const time = performance.now() / 1000;
    const motion = idleMotion(time, state);

    if (!framing.current) {
      gltf.scene.scale.setScalar(1);
      gltf.scene.position.set(0, 0, 0);
      gltf.scene.updateWorldMatrix(true, true);

      if (rig.head) {
        const headY = rig.head.getWorldPosition(new Vector3()).y;
        if (headY !== 0) framing.current = { offsetY: -headY, scale: 1 };
      } else {
        const box = new Box3().setFromObject(gltf.scene);
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        if (size.y > 0) {
          const scale = 0.85 / size.y;
          framing.current = { offsetY: -center.y * scale, scale };
        }
      }
      // Se la misura non e' ancora attendibile si riprova al frame dopo.
      if (!framing.current) return;
    }

    gltf.scene.scale.setScalar(framing.current.scale);
    gltf.scene.position.y = framing.current.offsetY + motion.breath;

    if (rig.head) {
      rig.head.rotation.y = motion.headYaw;
      rig.head.rotation.x = motion.headPitch;
    } else {
      // Senza scheletro si muove l'intera scena: su una testa o un busto e'
      // indistinguibile dal movimento del collo.
      gltf.scene.rotation.y = motion.headYaw;
      gltf.scene.rotation.x = motion.headPitch;
    }

    const target = state === "speaking" ? mouth.current : CLOSED_MOUTH;
    smoothed.current = dampWeights(smoothed.current, target);

    // L'apertura complessiva e' la somma dei visemi: serve alla mandibola e ai
    // modelli che hanno solo un blendshape generico.
    const opening = VISEMES.reduce(
      (sum, viseme) => sum + smoothed.current[viseme],
      0,
    );

    if (rig.jawBone) {
      // ~14 gradi a bocca spalancata: oltre, la mandibola si stacca dal viso.
      rig.jawBone.rotation.x = rig.jawRestX + opening * 0.25;
    } else if (rig.discovered) {
      setMorph(rig.discovered, opening);
    } else {
      // Visemi Oculus: uno per vocale, e' qui che il lip sync si vede.
      for (const viseme of VISEMES) {
        setMorph(OCULUS_VISEME[viseme], smoothed.current[viseme]);
      }
      // ARKit: la mandibola accompagna, e apre la bocca anche sui modelli che
      // hanno i blendshape ARKit ma non i visemi.
      setMorph("jawOpen", opening * 0.5);
      setMorph("mouthOpen", opening * 0.4);
      // Un accenno di sorriso mentre ascolta.
      const smile = state === "listening" ? 0.3 : 0.1;
      setMorph("mouthSmileLeft", smile);
      setMorph("mouthSmileRight", smile);
    }
  });

  return <primitive object={gltf.scene} />;
}

