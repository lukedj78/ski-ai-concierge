"use client";

import type { EveMessage } from "eve/client";
import { Streamdown } from "streamdown";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { Marker } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageGroup,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";

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
};

export function MessageList({ messages, busy }: MessageListProps) {
  return (
    // Il Provider e' obbligatorio: e' lui a tenere il contesto che il pulsante
    // "torna in fondo" legge. Senza, il pulsante lancia
    // "useMessageScroller must be used within a MessageScroller".
    <MessageScrollerProvider>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="px-4 py-6">
            {messages.map((message) => (
              <MessageScrollerItem key={message.id}>
                <MessageRow message={message} />
              </MessageScrollerItem>
            ))}
            {busy ? (
              <MessageScrollerItem scrollAnchor>
                <Marker className="gap-2">
                  <Spinner className="size-3" />
                  sto pensando
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
                  {part.state === "output-available" ? `${label} — fatto` : label}
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
