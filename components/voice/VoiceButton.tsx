"use client";

import { Mic01Icon, MicOff01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type VoiceButtonProps = {
  /** Chiamata con il testo trascritto, pronto per entrare nella conversazione. */
  onTranscript: (text: string) => void;
  /** Il microfono si apre e si chiude: il chiamante lo usa per l'avatar. */
  onListeningChange: (listening: boolean) => void;
  /** Segnala al chiamante che la voce non e' utilizzabile, con il motivo. */
  onUnavailable: (reason: string) => void;
  disabled?: boolean;
};

type Phase = "idle" | "recording" | "transcribing" | "blocked";

export function VoiceButton({
  onTranscript,
  onListeningChange,
  onUnavailable,
  disabled = false,
}: VoiceButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  function block(reason: string) {
    setPhase("blocked");
    setBlockedReason(reason);
    onListeningChange(false);
    onUnavailable(reason);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      block("Questo browser non da' accesso al microfono.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      block("Il microfono e' stato negato: puoi comunque scrivere.");
      return;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    recorder.addEventListener("stop", async () => {
      // Il microfono si spegne davvero: la spia del browser deve sparire.
      for (const track of stream.getTracks()) track.stop();
      onListeningChange(false);
      setPhase("transcribing");

      try {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const dataUrl = await blobToDataUrl(blob);
        const response = await fetch("/api/voice/transcribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ audio: dataUrl }),
        });
        const payload = await response.json();

        if (!response.ok) {
          if (response.status === 503) {
            block(payload.message ?? "La voce non e' disponibile.");
            return;
          }
          setPhase("idle");
          onUnavailable(payload.message ?? "Non sono riuscito a capire.");
          return;
        }

        setPhase("idle");
        onTranscript(payload.text as string);
      } catch {
        setPhase("idle");
        onUnavailable("La trascrizione non e' riuscita.");
      }
    });

    recorder.start();
    setPhase("recording");
    onListeningChange(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  const busy = phase === "transcribing";
  const recording = phase === "recording";
  const unusable = disabled || phase === "blocked";

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="icon"
        variant={recording ? "default" : "outline"}
        // 56px: e' il bersaglio che si preme con i guanti, non 44.
        className={cn(
          "size-14 rounded-full",
          recording && "ring-4 ring-ring/40 animate-pulse",
        )}
        disabled={unusable || busy}
        onClick={recording ? stopRecording : startRecording}
        aria-label={
          recording ? "Ferma la registrazione" : "Parla con il concierge"
        }
      >
        {busy ? (
          <Spinner className="size-5" />
        ) : (
          <HugeiconsIcon
            icon={unusable ? MicOff01Icon : Mic01Icon}
            size={22}
            strokeWidth={1.8}
          />
        )}
      </Button>
      {blockedReason ? (
        <span className="max-w-[26ch] text-[13px] text-on-surface-variant">
          {blockedReason}
        </span>
      ) : null}
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
