---
version: alpha
name: Ski AI Concierge
description: Neve e granito — un concierge da negozio di montagna, chiaro di giorno e leggibile con i guanti.
colors:
  primary: "#0B5D8C"
  primary-foreground: "#FFFFFF"
  secondary: "#EEF2F5"
  secondary-foreground: "#10171D"
  tertiary: "#E07A2F"
  neutral: "#F6F8FA"
  background: "#F6F8FA"
  foreground: "#10171D"
  surface: "#FFFFFF"
  surface-variant: "#EEF2F5"
  on-surface: "#10171D"
  on-surface-variant: "#55636E"
  muted: "#EEF2F5"
  muted-foreground: "#55636E"
  accent: "#E6F0F7"
  accent-foreground: "#0B5D8C"
  outline: "#D6DEE5"
  border: "#D6DEE5"
  input: "#D6DEE5"
  ring: "#0B5D8C"
  card: "#FFFFFF"
  card-foreground: "#10171D"
  popover: "#FFFFFF"
  popover-foreground: "#10171D"
  success: "#1F7A4D"
  alert: "#C77B12"
  error: "#C0392B"
  destructive: "#C0392B"
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
  caption:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.02em
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
components:
  button-primary:
    background: "{colors.primary}"
    foreground: "{colors.primary-foreground}"
    radius: "{rounded.md}"
    typography: "{typography.label-md}"
  button-secondary:
    background: "{colors.secondary}"
    foreground: "{colors.secondary-foreground}"
    radius: "{rounded.md}"
  card:
    background: "{colors.surface}"
    border: "{colors.outline}"
    radius: "{rounded.lg}"
  input:
    background: "{colors.surface}"
    border: "{colors.input}"
    radius: "{rounded.md}"
  badge-status:
    radius: "{rounded.full}"
    typography: "{typography.mono-sm}"
  bubble-user:
    background: "{colors.primary}"
    foreground: "{colors.primary-foreground}"
    radius: "{rounded.lg}"
  bubble-assistant:
    background: "{colors.surface-variant}"
    foreground: "{colors.on-surface}"
    radius: "{rounded.lg}"
---

# Ski AI Concierge — DESIGN.md

## Overview

L'interfaccia deve sembrare il **banco di un negozio di montagna a metà mattina**:
luce da neve, superfici pulite, informazioni essenziali. Non un prodotto AI che
si mette in mostra — un negozio che ha assunto qualcuno di bravo.

Chi la usa sta pianificando una vacanza, spesso dal telefono, spesso di sera. Non
vuole imparare un'interfaccia: vuole fare una domanda. Quindi la schermata è una
sola, la conversazione è il centro, e tutto il resto sta ai margini.

L'avatar 3D occupa spazio reale ed è il primo segnale di stato: prima di leggere
una parola si capisce se il concierge sta ascoltando, pensando o parlando. Il
resto della UI non compete con lui — niente animazioni decorative, niente
gradienti gratuiti, nessun effetto vetro.

Tono: professionale e caldo. La stessa cosa che si prova quando qualcuno dietro al
banco ti dice «con il tuo peso quel modello lo pieghi troppo, prendi questo».

## Colors

La palette nasce dalla montagna vera, non dal marketing della montagna: neve in
ombra, granito bagnato, ghiaccio in profondità, arancio della segnaletica.

- **Primary (#0B5D8C)** — blu ghiacciaio profondo. È il colore dell'azione: il
  pulsante di prenotazione, i messaggi dell'utente, il focus ring. Usato con
  parsimonia; se è ovunque non indica più niente.
- **Tertiary (#E07A2F)** — arancio della segnaletica di pista. Serve a chiamare
  l'attenzione su una cosa sola alla volta: un consiglio, una scadenza, un
  suggerimento di upselling. Mai come colore di sfondo esteso.
- **Neutral (#F6F8FA)** — neve in ombra. È lo sfondo della pagina, leggermente
  più freddo del bianco per non affaticare in una sessione lunga.
- **Surface (#FFFFFF)** — le card e il pannello della chat, che devono staccare
  dallo sfondo per un gradino appena.
- **On-surface (#10171D)** — nero-blu del granito bagnato. Non nero puro: il nero
  puro su bianco puro è più stanco da leggere.
- **On-surface-variant (#55636E)** — grigio pietra, per metadati, orari, taglie e
  tutto ciò che accompagna senza reclamare.
- **Outline (#D6DEE5)** — bordi e separatori, appena percettibili.
- **Semantici** — success `#1F7A4D` (verde bosco: disponibile, confermato), alert
  `#C77B12` (giallo valanga: in scadenza, ultimo pezzo), error `#C0392B` (rosso
  segnaletica: non disponibile, prenotazione fallita).

## Typography

Tre famiglie, ciascuna con un mestiere preciso.

- **Space Grotesk** per display e headline. Ha un carattere tecnico e alpino, e a
  48px regge l'unico titolo grande della pagina senza sembrare un banner.
- **Inter** per tutto il resto: titoli di card, corpo, etichette, didascalie. È la
  scelta noiosa e giusta per un'interfaccia che si legge, non si ammira.
- **JetBrains Mono** per i dati tecnici: lunghezze sci in cm, mondopoint, codici
  prenotazione, prezzi in tabella. Il monospace qui non è vezzo: allinea le cifre
  e rende un mondopoint riconoscibile a colpo d'occhio.

Pesi in uso: 400, 500, 600. Nessun 700 — la gerarchia si fa con la dimensione e
il colore, non col grassetto.

## Layout & Spacing

Una schermata sola, tre fasce.

- **Header** (56px): nome del negozio a sinistra, stato della connessione a
  destra. Nient'altro. Non è un sito, non serve un menu.
- **Corpo**: due colonne su desktop — avatar a sinistra (≈40%), chat a destra
  (≈60%) — dentro un contenitore `max-w-[1280px]` con padding `24px`, `48px` da
  `lg` in su.
- **Barra voce** (72px): microfono al centro, stato dell'agente leggibile accanto.
  Sticky in fondo su mobile.

La scala di spaziatura è a base 8 con un gradino a 4 per le distanze interne alle
etichette. Le sezioni respirano a `xl` (40px); dentro le card si sta a `md`
(16px). La densità è media: né dashboard, né landing page.

### Responsive Behavior

| Larghezza | Comportamento |
|---|---|
| ≤ 767px | Colonna unica. Avatar sopra, altezza fissa 240px. Chat sotto, a piena larghezza. Barra voce sticky in fondo. Padding 16px. |
| 768–1023px | Colonna unica, avatar a 320px, chat più alta. Padding 24px. |
| ≥ 1024px | Due colonne 40/60 affiancate, avatar e chat alla stessa altezza. Padding 48px. |
| ≥ 1440px | Uguale, contenitore fermo a 1280px e centrato. |

Il titolo display scende da 48px a 32px sotto `lg`. Tutti i bersagli toccabili
stanno a 44px minimi: il pulsante del microfono a 56px, perché è quello che si
preme con le mani fredde.

## Elevation & Depth

Nessuna ombra drammatica, nessun glassmorphism. La profondità è data dal
contrasto fra `background` e `surface` e da un bordo di 1px.

- **Livello 0** — sfondo pagina, nessuna ombra.
- **Livello 1** — card e pannello chat: `1px solid outline` e ombra
  `0 1px 2px rgb(16 23 29 / 0.04)`.
- **Livello 2** — popover, dropdown, toast: `0 8px 24px rgb(16 23 29 / 0.10)`.

L'unica eccezione è il canvas dell'avatar, che ha un gradiente radiale freddo
molto tenue dal centro verso i bordi: serve a staccare la figura dal fondo, non a
fare atmosfera.

## Shapes

Raggi contenuti, niente pillole ovunque.

- `sm` 6px — input, badge rettangolari, chip.
- `md` 10px — pulsanti, campi di testo.
- `lg` 16px — card, pannello chat, bolle dei messaggi.
- `xl` 24px — il contenitore dell'avatar.
- `full` — solo il pulsante del microfono e i badge di stato.

## Components

- **Bolle dei messaggi** — utente: fondo `primary`, testo bianco, raggio `lg` con
  l'angolo in basso a destra a `sm`. Assistente: fondo `surface-variant`, testo
  `on-surface`, angolo in basso a sinistra a `sm`. Larghezza massima 75% della
  colonna. Il markdown della risposta va reso, non stampato.
- **Pulsante microfono** — cerchio da 56px. A riposo: `surface` con bordo
  `outline`. In ascolto: fondo `primary` con un anello pulsante. Non disponibile:
  `muted` con cursore `not-allowed` e motivo leggibile accanto.
- **Stato dell'agente** — testo `label-md` in `on-surface-variant` accanto al
  microfono: «pronto», «ti ascolto», «sto controllando la disponibilità»,
  «rispondo». Mai un'icona da sola: lo stato si legge.
- **Card di proposta attrezzatura** — `surface`, bordo `outline`, raggio `lg`.
  Titolo `title-md`, misure in `mono-sm`, prezzo allineato a destra in `mono-sm`,
  una riga di motivazione in `caption` `on-surface-variant`.
- **Badge di stato** — `full`, `mono-sm` maiuscolo: `disponibile` su fondo verde
  tenue, `ultimo pezzo` su giallo tenue, `esaurito` su rosso tenue.
- **Contenitore avatar** — `xl`, `surface`, gradiente radiale interno appena
  accennato, nessun bordo.

## Do's and Don'ts

**Do**

- Usa `primary` solo per l'azione principale e per i messaggi dell'utente.
- Metti i dati tecnici — cm, mondopoint, prezzi, codici — in `mono-sm`.
- Scrivi lo stato dell'agente a parole, sempre accompagnato dall'avatar.
- Lascia che l'avatar sia l'elemento visivo più forte della pagina.
- Rendi il markdown delle risposte del modello: elenchi e grassetti servono a
  leggere una proposta di attrezzatura.

**Don't**

- Non usare `tertiary` come sfondo di aree ampie: è un colore da segnaletica.
- Non aggiungere animazioni decorative attorno alla chat: competono con l'avatar
  e disturbano il segnale di stato.
- Non usare glassmorphism, ombre colorate o gradienti sui pulsanti.
- Non ridurre i bersagli toccabili sotto 44px, e mai il microfono sotto 56px.
- Non usare peso 700: la gerarchia si fa con dimensione e colore.
- Non mostrare spinner anonimi quando l'agente lavora: lo stato ha un nome, e va
  scritto.
