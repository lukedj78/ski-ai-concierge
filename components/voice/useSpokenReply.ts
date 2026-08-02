"use client";

import { useCallback, useRef, useState } from "react";
import { rmsFromTimeDomain } from "@/components/avatar/animations/lipSync";

/**
 * La risposta parlata, frase per frase.
 *
 * Sintetizzare l'intera risposta e poi riprodurla significa aspettare che il
 * testo finisca *e* che la sintesi finisca: sono secondi di silenzio mentre
 * sullo schermo il testo e' gia' li'. Qui le frasi entrano in coda man mano
 * che arrivano dallo stream: la prima si sente mentre l'ultima non e' ancora
 * stata scritta.
 *
 * L'ordine e' garantito da un unico worker sequenziale — le richieste di
 * sintesi possono tornare in ordine sparso, la riproduzione no.
 */
export function useSpokenReply() {
  const [amplitude, setAmplitude] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const queue = useRef<string[]>([]);
  const running = useRef(false);
  const cancelled = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  // Un elemento <audio> puo' essere collegato al grafo audio una volta sola:
  // il nodo sorgente va tenuto e riusato, non ricreato a ogni frase.
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const stopMeasuring = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setAmplitude(0);
  }, []);

  const reset = useCallback(() => {
    cancelled.current = true;
    queue.current = [];
    audioRef.current?.pause();
    stopMeasuring();
    setSpeaking(false);
  }, [stopMeasuring]);

  const playChunk = useCallback(
    async (audioBase64: string, mediaType: string) => {
      // L'elemento audio si crea una volta sola e si riusa: crearne uno per
      // frase esaurirebbe il grafo audio in una conversazione lunga.
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.crossOrigin = "anonymous";
      }
      const audio = audioRef.current;

      contextRef.current ??= new AudioContext();
      const context = contextRef.current;
      if (context.state === "suspended") await context.resume();

      if (!sourceRef.current) {
        sourceRef.current = context.createMediaElementSource(audio);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        sourceRef.current.connect(analyser);
        analyser.connect(context.destination);
        analyserRef.current = analyser;
      }

      audio.src = `data:${mediaType};base64,${audioBase64}`;

      const buffer = new Uint8Array(analyserRef.current?.fftSize ?? 512);
      const measure = () => {
        const analyser = analyserRef.current;
        if (!analyser) return;
        analyser.getByteTimeDomainData(buffer);
        setAmplitude(rmsFromTimeDomain(buffer));
        frameRef.current = requestAnimationFrame(measure);
      };

      await audio.play();
      measure();

      await new Promise<void>((resolve) => {
        const done = () => {
          audio.removeEventListener("ended", done);
          audio.removeEventListener("error", done);
          resolve();
        };
        audio.addEventListener("ended", done);
        audio.addEventListener("error", done);
      });

      stopMeasuring();
    },
    [stopMeasuring],
  );

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    cancelled.current = false;
    setSpeaking(true);

    try {
      while (queue.current.length > 0 && !cancelled.current) {
        const text = queue.current.shift();
        if (!text) continue;

        const response = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.message ?? "La risposta parlata non e' disponibile.",
          );
        }

        const payload = await response.json();
        if (cancelled.current) break;
        await playChunk(payload.audio as string, payload.mediaType as string);
      }
    } finally {
      running.current = false;
      setSpeaking(false);
      stopMeasuring();
    }
  }, [playChunk, stopMeasuring]);

  /** Accoda una frase da leggere. Ritorna subito: la coda va avanti da sola. */
  const enqueue = useCallback(
    (text: string, onError?: (message: string) => void) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      queue.current.push(trimmed);
      drain().catch((error: unknown) => {
        onError?.(
          error instanceof Error
            ? error.message
            : "La risposta parlata non e' disponibile.",
        );
      });
    },
    [drain],
  );

  return { amplitude, speaking, enqueue, reset };
}

/**
 * Ritaglia dal buffer le frasi gia' complete, lasciando dentro la coda ancora
 * in corso di scrittura.
 *
 * Il taglio e' sulla punteggiatura forte e sugli a capo. La soglia minima
 * evita di mandare in sintesi frammenti di tre parole: sotto una certa
 * lunghezza il costo della chiamata supera il guadagno, e la voce risulta
 * spezzettata.
 */
export function takeCompleteSentences(
  buffer: string,
  minLength = 45,
): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  const boundary = /[.!?…]+["')\]]*\s|\n+/g;

  let pending = "";
  let lastCut = 0;

  for (const match of buffer.matchAll(boundary)) {
    const end = (match.index ?? 0) + match[0].length;
    const chunk = buffer.slice(lastCut, end).trim();
    lastCut = end;

    pending = pending ? `${pending} ${chunk}` : chunk;
    if (pending.length >= minLength) {
      sentences.push(pending);
      pending = "";
    }
  }

  const tail = buffer.slice(lastCut);
  const rest = pending ? `${pending} ${tail}` : tail;

  return { sentences, rest };
}

/**
 * Toglie il markdown prima di mandare il testo alla sintesi.
 *
 * Senza, la voce legge gli asterischi e i trattini di elenco: «asterisco
 * asterisco Scegliere l'attrezzatura asterisco asterisco».
 */
export function toSpeakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_#>]/g, " ")
    .replace(/^\s*[-–•]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
