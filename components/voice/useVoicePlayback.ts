"use client";

import { useCallback, useRef, useState } from "react";
import { rmsFromTimeDomain } from "@/components/avatar/animations/lipSync";

/**
 * Riproduce l'audio della risposta e ne misura l'ampiezza, frame per frame.
 *
 * L'ampiezza e' l'unica cosa che l'avatar riceve oltre allo stato: da li'
 * ricava quanto aprire la bocca. Il ciclo di misura vive qui e non nella
 * scena 3D, cosi' l'avatar resta ignaro anche dell'esistenza dell'audio.
 */
export function useVoicePlayback() {
  const [amplitude, setAmplitude] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
    setAmplitude(0);
  }, []);

  const play = useCallback(
    async (audioBase64: string, mediaType: string) => {
      stop();

      const audio = new Audio(`data:${mediaType};base64,${audioBase64}`);
      audioRef.current = audio;

      // Il contesto audio si crea una volta sola e si riusa: crearne uno per
      // ogni risposta esaurisce le risorse del browser dopo pochi turni.
      contextRef.current ??= new AudioContext();
      const context = contextRef.current;
      if (context.state === "suspended") await context.resume();

      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(context.destination);
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.fftSize);

      const measure = () => {
        const active = analyserRef.current;
        if (!active) return;
        active.getByteTimeDomainData(buffer);
        setAmplitude(rmsFromTimeDomain(buffer));
        frameRef.current = requestAnimationFrame(measure);
      };

      audio.addEventListener("ended", stop, { once: true });
      audio.addEventListener("error", stop, { once: true });

      setSpeaking(true);
      await audio.play();
      measure();
    },
    [stop],
  );

  return { amplitude, speaking, play, stop };
}
