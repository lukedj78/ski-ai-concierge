"use client";

import type { EveMessage } from "eve/client";
import { Wrench01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Streamdown } from "streamdown";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { Marker } from "@/components/ui/marker";
import { Message, MessageContent, MessageGroup } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";

/**
 * Mostrare i tool che girano.
 *
 * Serve in questa fase di sviluppo, per vedere che il concierge interroga
 * davvero il negozio invece di inventare. Si spegne con
 * NEXT_PUBLIC_SHOW_TOOLS=false quando si va live.
 */
const SHOW_TOOLS = process.env.NEXT_PUBLIC_SHOW_TOOLS !== "false";

/** Cosa scrivere mentre un tool lavora. Lo stato ha un nome, non uno spinner muto. */
const TOOL_LABEL: Record<string, string> = {
  get_equipment_availability: "controllo la disponibilita'",
  calculate_rental_price: "calcolo il prezzo",
  create_booking: "registro la prenotazione",
  recommend_equipment: "cerco l'attrezzatura adatta",
  search_knowledge: "cerco nelle informazioni del negozio",
  load_skill: "recupero la procedura",
  voice: "preparo la risposta parlata",
};

export type MessageListProps = {
  messages: readonly EveMessage[];
  busy: boolean;
  /**
   * Il turno che il negozio sta elaborando, con i tool che stanno girando.
   * Serve a non lasciare lo schermo fermo proprio mentre si lavora.
   */
  thinking?: { question: string; tools: string[] } | null;
  /** Il concierge sta preparando la risposta, prima ancora di parlare. */
  responding?: boolean;
};

export function MessageList({
  messages,
  busy,
  thinking,
  responding,
}: MessageListProps) {
  return (
    // Il Provider e' obbligatorio: e' lui a tenere il contesto che il pulsante
    // "torna in fondo" legge. Senza, il pulsante lancia
    // "useMessageScroller must be used within a MessageScroller".
    <MessageScrollerProvider>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="px-4 py-6">
            {messages.map((message, index) => (
              <MessageScrollerItem
                key={message.id}
                // L'ancora sta sull'ultimo messaggio e basta: e' la
                // composizione prevista dal primitivo. Metterla anche sulle
                // righe di attesa — che compaiono e spariscono — faceva
                // saltare la vista a ogni turno.
                scrollAnchor={index === messages.length - 1}
              >
                <MessageRow message={message} />
              </MessageScrollerItem>
            ))}
            {thinking ? (
              <MessageScrollerItem>
                <div className="space-y-1.5 py-1">
                  <Marker className="gap-2">
                    <Spinner className="size-3" />
                    controllo in negozio
                  </Marker>
                  {SHOW_TOOLS
                    ? thinking.tools.map((tool, index) => (
                        <Marker
                          // I tool possono ripetersi nello stesso turno: la
                          // chiave tiene conto anche della posizione.
                          key={`${tool}-${index}`}
                          className="ml-4 gap-2 font-[family-name:var(--font-jetbrains-mono)] text-[12px]"
                        >
                          <HugeiconsIcon
                            icon={Wrench01Icon}
                            size={13}
                            strokeWidth={1.8}
                          />
                          {tool}
                          <span className="text-on-surface-variant">
                            — {TOOL_LABEL[tool] ?? "in corso"}
                          </span>
                        </Marker>
                      ))
                    : null}
                </div>
              </MessageScrollerItem>
            ) : responding ? (
              <MessageScrollerItem>
                <Marker className="gap-2">
                  <Spinner className="size-3" />
                  sto pensando
                </Marker>
              </MessageScrollerItem>
            ) : busy ? (
              <MessageScrollerItem>
                <Marker className="gap-2">
                  <Spinner className="size-3" />
                  un attimo
                </Marker>
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        {/* Il posizionamento se lo porta dietro il primitivo. */}
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

function MessageRow({ message }: { message: EveMessage }) {
  const isUser = message.role === "user";

  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageContent>
        <BubbleGroup>
          {message.parts.map((part, index) => {
            if (part.type === "text") {
              return (
                <Bubble
                  // Le parti non hanno un id proprio: l'indice e' stabile
                  // perche' lo stream le aggiunge in coda, non le riordina.
                  key={`${message.id}-text-${index}`}
                  variant={isUser ? "default" : "secondary"}
                  align={isUser ? "end" : "start"}
                >
                  <BubbleContent>
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{part.text}</span>
                    ) : (
                      // Il markdown va reso: un elenco di attrezzatura scritto
                      // con gli asterischi a vista non si legge.
                      <Streamdown className="[&_p]:m-0 [&_ul]:my-1 [&_ul]:pl-4 space-y-2">
                        {part.text}
                      </Streamdown>
                    )}
                  </BubbleContent>
                </Bubble>
              );
            }

            if (part.type === "dynamic-tool") {
              const label = TOOL_LABEL[part.toolName] ?? part.toolName;
              return (
                <Marker
                  key={`${message.id}-tool-${index}`}
                  className="font-[family-name:var(--font-jetbrains-mono)] text-[12px]"
                >
                  {part.state === "output-available"
                    ? `${label} — fatto`
                    : label}
                </Marker>
              );
            }

            return null;
          })}
        </BubbleGroup>
      </MessageContent>
    </Message>
  );
}
