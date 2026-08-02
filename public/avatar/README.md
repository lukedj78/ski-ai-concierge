# Il modello dell'avatar

`instructor.glb` e' il modello 3D del concierge. E' versionato di proposito:
senza, ogni pubblicazione dipenderebbe da cosa viene caricato al momento, e la
scena resterebbe vuota.

## Da dove viene

E' uno degli avatar di esempio del progetto
[TalkingHead](https://github.com/met4citizen/TalkingHead) (licenza MIT), scelto
perche' porta con se' tutto quello che serve al lip sync:

- 72 morph target, inclusi i quindici visemi Oculus (`viseme_aa`, `viseme_I`,
  `viseme_O`, `viseme_E`, `viseme_U`, ...)
- i blendshape ARKit della bocca (`jawOpen`, `mouthSmile*`)
- uno scheletro di 67 ossa con l'osso `Head`, su cui si allinea l'inquadratura

E' un avatar da dimostrazione, non l'identita' del negozio: prima di andare
davvero live va sostituito con un modello proprio.

## Come si sostituisce

Metti il tuo file qui come `instructor.glb` (oppure `.vrm`) e verificalo:

```bash
pnpm avatar:inspect
```

Lo strumento dice se il modello ha i blendshape per il lip sync e l'osso della
testa. Se i nomi non sono standard il codice cerca comunque qualcosa che apra
la bocca, e in ultima istanza ruota l'osso della mandibola.

Per puntare a un modello ospitato altrove, senza toccare questa cartella:

```bash
NEXT_PUBLIC_AVATAR_URL=https://esempio.com/maestro.glb
```
