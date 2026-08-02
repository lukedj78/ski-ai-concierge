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
  /** L'unico dato che arriva dal mondo esterno, insieme all'ampiezza. */
  state: AvatarState;
  /** Ampiezza dell'audio in riproduzione, fra 0 e 1. */
  amplitude?: number;
  /**
   * I pesi dei visemi stimati dalle formanti: dicono *quale* vocale, non solo
   * quanto e' aperta la bocca.
   */
  visemes?: VisemeWeights;
  /** URL del modello VRM. `null` fa scattare il segnaposto procedurale. */
  vrmUrl: string | null;
};

/**
 * La figura del maestro di sci.
 *
 * Non sa niente di eve, di modelli AI, di database o di prenotazioni: riceve
 * uno stato e un'ampiezza e li mette in scena. Se un giorno l'orchestratore
 * cambiasse, questo file non se ne accorgerebbe.
 */
export function Avatar3D({
  state,
  amplitude = 0,
  visemes,
  vrmUrl,
}: Avatar3DProps) {
  const mouth = visemes ?? CLOSED_MOUTH;
  const fallback = (
    <PlaceholderFigure state={state} amplitude={amplitude} mouth={mouth} />
  );

  if (!vrmUrl) return fallback;

  // Due formati, due strade. `.vrm` porta con se' le espressioni standard;
  // un `.glb` realistico (Ready Player Me, Avaturn, un modello proprio) porta
  // i morph target ARKit e i visemi Oculus. Il resto dell'interfaccia non
  // vede la differenza.
  const isVrm = vrmUrl.split("?")[0]?.toLowerCase().endsWith(".vrm") ?? false;

  return (
    <AvatarFallbackBoundary fallback={fallback}>
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
  mouth: VisemeWeights;
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
    const target = state === "speaking" ? mouth : CLOSED_MOUTH;
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
  mouth: VisemeWeights;
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

    const target = state === "speaking" ? mouth : CLOSED_MOUTH;
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

/**
 * Il maestro di sci disegnato a mano, in geometria.
 *
 * Serve quando in `public/avatar/` non c'e' nessun `.vrm`, e non e' un
 * ripiego travestito: casco con visiera, maschera a specchio con la lente
 * ambrata, scaldacollo, giacca con collo alto e zip, spalle e braccia. Il
 * repository resta eseguibile a mani vuote e la demo regge lo stesso.
 *
 * Le forme sono tutte arrotondate — sfere, capsule, tori — perche' i cubi
 * leggono come "segnaposto" e le curve come "personaggio".
 */
function PlaceholderFigure({
  state,
  amplitude,
  mouth,
}: {
  state: AvatarState;
  amplitude: number;
  mouth: VisemeWeights;
}) {
  const group = useRef<Group>(null);
  const head = useRef<Group>(null);
  const mouthRef = useRef<Mesh>(null);
  const opening = useRef(0);
  const widthRef = useRef(1);

  useFrame(() => {
    const time = performance.now() / 1000;
    const motion = idleMotion(time, state);

    if (group.current) group.current.position.y = motion.breath - 0.16;
    if (head.current) {
      head.current.rotation.y = motion.headYaw;
      head.current.rotation.x = motion.headPitch;
    }

    // Anche la figura disegnata segue i visemi: la "a" apre, la "i" allarga,
    // la "u" arrotonda. Non e' un viso vero, ma non e' nemmeno una feritoia
    // che va su e giu'.
    const height =
      mouth.aa * 2.6 +
      mouth.oh * 1.8 +
      mouth.ee * 1.2 +
      mouth.ou * 1.4 +
      mouth.ih * 0.8;
    const width =
      1 + mouth.ee * 0.5 + mouth.ih * 0.6 - mouth.ou * 0.4 - mouth.oh * 0.25;

    opening.current = damp(opening.current, state === "speaking" ? height : 0);
    widthRef.current = damp(widthRef.current, state === "speaking" ? width : 1);

    if (mouthRef.current) {
      mouthRef.current.scale.set(widthRef.current, 0.3 + opening.current, 1);
    }
  });

  // La lente della maschera cambia colore con lo stato: e' il segnale
  // leggibile a colpo d'occhio, anche in miniatura.
  const lens =
    state === "listening"
      ? "#0b5d8c"
      : state === "thinking"
        ? "#e07a2f"
        : state === "speaking"
          ? "#1f7a4d"
          : "#2f4858";

  const skin = "#e8c6a8";
  const jacket = "#0b5d8c";
  const jacketDark = "#08476a";
  const gear = "#1c2a33";

  return (
    <group ref={group}>
      {/* ---------------------------------------------------------------- */}
      {/* Busto: giacca da sci, spalle piene e collo alto                    */}
      {/* ---------------------------------------------------------------- */}
      <mesh position={[0, -0.72, 0]}>
        <capsuleGeometry args={[0.34, 0.46, 12, 32]} />
        <meshStandardMaterial color={jacket} roughness={0.55} />
      </mesh>
      {/* Spalle: due sfere schiacciate, danno la linea imbottita */}
      <mesh position={[-0.33, -0.55, 0]} scale={[1, 0.8, 1]}>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshStandardMaterial color={jacket} roughness={0.55} />
      </mesh>
      <mesh position={[0.33, -0.55, 0]} scale={[1, 0.8, 1]}>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshStandardMaterial color={jacket} roughness={0.55} />
      </mesh>
      {/* Braccia appena accennate: l'inquadratura le taglia a meta' */}
      <mesh position={[-0.4, -0.86, 0]} rotation={[0, 0, 0.16]}>
        <capsuleGeometry args={[0.11, 0.3, 8, 20]} />
        <meshStandardMaterial color={jacketDark} roughness={0.6} />
      </mesh>
      <mesh position={[0.4, -0.86, 0]} rotation={[0, 0, -0.16]}>
        <capsuleGeometry args={[0.11, 0.3, 8, 20]} />
        <meshStandardMaterial color={jacketDark} roughness={0.6} />
      </mesh>
      {/* Zip centrale */}
      <mesh position={[0, -0.72, 0.33]} scale={[1, 1, 0.4]}>
        <capsuleGeometry args={[0.012, 0.42, 6, 12]} />
        <meshStandardMaterial color="#d8e3ea" roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Collo della giacca */}
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[0.19, 0.22, 0.16, 32]} />
        <meshStandardMaterial color={jacketDark} roughness={0.6} />
      </mesh>

      {/* ---------------------------------------------------------------- */}
      {/* Testa                                                             */}
      {/* ---------------------------------------------------------------- */}
      <group ref={head} position={[0, -0.02, 0]}>
        {/* Scaldacollo, sotto il mento */}
        <mesh position={[0, -0.24, 0.01]}>
          <cylinderGeometry args={[0.17, 0.19, 0.14, 32]} />
          <meshStandardMaterial color={gear} roughness={0.85} />
        </mesh>

        {/* Volto: una sfera leggermente allungata legge come una testa,
            una sfera perfetta legge come una palla */}
        <mesh scale={[0.94, 1.06, 0.96]}>
          <sphereGeometry args={[0.25, 48, 48]} />
          <meshStandardMaterial color={skin} roughness={0.72} />
        </mesh>

        {/* Orecchie */}
        <mesh position={[-0.235, -0.01, 0]} scale={[0.5, 1, 0.7]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={skin} roughness={0.75} />
        </mesh>
        <mesh position={[0.235, -0.01, 0]} scale={[0.5, 1, 0.7]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={skin} roughness={0.75} />
        </mesh>

        {/* Casco: mezza sfera che copre la calotta */}
        <mesh position={[0, 0.045, -0.005]} scale={[1.06, 1, 1.06]}>
          <sphereGeometry
            args={[0.263, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.62]}
          />
          <meshStandardMaterial
            color={gear}
            roughness={0.35}
            metalness={0.15}
          />
        </mesh>
        {/* Visiera del casco */}
        <mesh position={[0, 0.12, 0.13]} rotation={[0.35, 0, 0]}>
          <cylinderGeometry
            args={[0.2, 0.2, 0.02, 32, 1, false, Math.PI * 1.15, Math.PI * 0.7]}
          />
          <meshStandardMaterial color="#101a20" roughness={0.4} />
        </mesh>

        {/* Cinghia della maschera, tutt'attorno alla testa */}
        <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.253, 0.028, 16, 48]} />
          <meshStandardMaterial color="#0a1216" roughness={0.8} />
        </mesh>

        {/* Maschera: scocca */}
        <mesh position={[0, 0.045, 0.13]} scale={[1, 0.62, 0.5]}>
          <sphereGeometry args={[0.235, 40, 32]} />
          <meshStandardMaterial color="#141f26" roughness={0.5} />
        </mesh>
        {/* Maschera: lente a specchio — e' l'unico punto lucido della figura,
            e cambia colore con lo stato */}
        <mesh position={[0, 0.045, 0.155]} scale={[1, 0.56, 0.42]}>
          <sphereGeometry args={[0.228, 40, 32]} />
          <meshStandardMaterial
            color={lens}
            roughness={0.08}
            metalness={0.85}
            envMapIntensity={1.4}
          />
        </mesh>

        {/* Naso */}
        <mesh position={[0, -0.07, 0.22]} scale={[0.7, 1, 0.9]}>
          <sphereGeometry args={[0.042, 20, 20]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>

        {/* Bocca: si apre con l'audio */}
        <mesh ref={mouthRef} position={[0, -0.145, 0.205]} scale={[1, 0.3, 1]}>
          <capsuleGeometry args={[0.055, 0.03, 8, 20]} />
          <meshStandardMaterial color="#8c4a49" roughness={0.6} />
        </mesh>

        {/* Barba corta: due giorni, come chiunque lavori in quota a febbraio */}
        <mesh position={[0, -0.155, 0.12]} scale={[0.85, 0.5, 0.7]}>
          <sphereGeometry args={[0.2, 32, 24]} />
          <meshStandardMaterial
            color="#7b6552"
            roughness={0.95}
            transparent
            opacity={0.5}
          />
        </mesh>
      </group>
    </group>
  );
}
