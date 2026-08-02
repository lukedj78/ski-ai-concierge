/**
 * Ispeziona un modello GLB e dice se e' animabile.
 *
 * Serve a rispondere prima di aprire il browser alle due domande che contano:
 * questo file ha i blendshape per il lip sync? ha uno scheletro con l'osso
 * della testa? Se la risposta e' no, nessun codice puo' rimediare — e meglio
 * saperlo dal terminale che scoprirlo guardando un avatar con la bocca ferma.
 *
 * Un GLB e' un contenitore binario: intestazione di 12 byte, poi un chunk JSON
 * con tutta la struttura glTF, poi il chunk dei dati. Qui basta il primo, e si
 * legge senza dipendenze.
 *
 *   pnpm avatar:inspect [percorso]
 */

import { readFile } from "node:fs/promises";
import { argv } from "node:process";

const DEFAULT_PATH = "public/avatar/instructor.glb";

type Gltf = {
  meshes?: {
    name?: string;
    primitives?: { targets?: unknown[] }[];
    extras?: { targetNames?: string[] };
  }[];
  nodes?: { name?: string }[];
  skins?: { joints?: number[] }[];
  materials?: unknown[];
  images?: unknown[];
  animations?: { name?: string }[];
};

function readGltfJson(buffer: Buffer): Gltf {
  const magic = buffer.toString("utf8", 0, 4);
  if (magic !== "glTF") {
    throw new Error(
      "Non e' un file GLB. L'app carica glTF binario (.glb) o VRM: FBX, OBJ e USDZ non vanno.",
    );
  }

  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString("utf8", 16, 20);
  if (chunkType.trim() !== "JSON") {
    throw new Error("Il primo chunk del GLB non e' JSON: file malformato.");
  }

  return JSON.parse(buffer.toString("utf8", 20, 20 + chunkLength)) as Gltf;
}

const path = argv[2] ?? DEFAULT_PATH;

let buffer: Buffer;
try {
  buffer = await readFile(path);
} catch {
  console.error(`Nessun file in ${path}.`);
  console.error(
    "Esporta l'avatar in GLB e salvalo li', oppure passa un altro percorso.",
  );
  process.exit(1);
}

const gltf = readGltfJson(buffer);

// I nomi dei morph target stanno in `mesh.extras.targetNames`: e' la
// convenzione che seguono tutti gli esportatori (Blender, Avaturn, RPM).
const targetNames = new Set<string>();
let meshesWithTargets = 0;
for (const mesh of gltf.meshes ?? []) {
  const names = mesh.extras?.targetNames ?? [];
  if (names.length > 0) meshesWithTargets += 1;
  for (const name of names) targetNames.add(name);
}

const nodeNames = (gltf.nodes ?? []).map((node) => node.name ?? "");
const headBone = nodeNames.find((name) => /^head$/i.test(name));
const joints = (gltf.skins ?? []).reduce(
  (total, skin) => total + (skin.joints?.length ?? 0),
  0,
);

const visemes = [...targetNames].filter((name) => /^viseme_/i.test(name));
const arkitMouth = [...targetNames].filter((name) =>
  /^(jawOpen|mouthOpen|mouthSmile|mouthFunnel|mouthPucker)/i.test(name),
);

console.log(`\nFile           ${path}`);
console.log(`Dimensione     ${(buffer.length / 1_048_576).toFixed(1)} MB`);
console.log(`Mesh           ${gltf.meshes?.length ?? 0}`);
console.log(`Materiali      ${gltf.materials?.length ?? 0}`);
console.log(`Texture        ${gltf.images?.length ?? 0}`);
console.log(`Animazioni     ${gltf.animations?.length ?? 0}`);
console.log(`Ossa           ${joints > 0 ? joints : "nessuno scheletro"}`);
console.log(
  `Osso testa     ${headBone ? `si' (${headBone})` : "assente — si ruotera' tutto il modello"}`,
);
console.log(
  `\nMorph target   ${targetNames.size} su ${meshesWithTargets} mesh`,
);

if (targetNames.size === 0) {
  console.log(
    "\n  Nessun blendshape: l'avatar si vedra' e respirera', ma la bocca\n" +
      "  restera' ferma mentre parla. Serve un export che li includa.\n",
  );
  process.exit(0);
}

if (visemes.length > 0) {
  console.log(`  Visemi Oculus  ${visemes.sort().join(", ")}`);
}
if (arkitMouth.length > 0) {
  console.log(`  Bocca ARKit    ${arkitMouth.sort().join(", ")}`);
}

const drivable = ["viseme_aa", "viseme_I", "viseme_O", "jawOpen", "mouthOpen"];
const usable = drivable.filter((name) => targetNames.has(name));

console.log(
  usable.length > 0
    ? `\n  Lip sync: funziona. Il codice pilotera' ${usable.join(", ")}.\n`
    : "\n  Ci sono blendshape ma nessuno con un nome noto: il codice ne\n" +
        "  cerchera' uno che apra la bocca. Controlla l'elenco qui sopra.\n",
);
