import { Fragment, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import type { Message } from "@/lib/chat/types";
import { formatDayLabel } from "@/lib/chat/format";
import { MessageBubble } from "./MessageBubble";

function reportMountedHistory(hasMessages: boolean) {
  if (typeof window === "undefined" || typeof fetch !== "function" ||
      !["127.0.0.1", "localhost"].includes(window.location.hostname)) return;
  const api = (import.meta.env["VITE_API_URL"] as string | undefined)
    ?.replace(/\/$/, "") || "http://127.0.0.1:3001";
  void fetch(`${api}/internal/client-diagnostic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "HISTORY_DOM_MOUNTED",
      status: hasMessages ? "HAS_MESSAGES" : "EMPTY" }),
  }).catch(() => {});
}

export function MessageList({ messages, onReply, onReact, onForward, onEdit, onDelete, onStar, onOpenContact,
  searchTerm = "", selectedMatchId }: {
  messages: Message[];
  onReply?: ((message: Message) => void) | undefined;
  onReact?: ((message: Message, emoji: string) => void) | undefined;
  onForward?: ((message: Message) => void) | undefined;
  onEdit?: ((message: Message) => void) | undefined;
  onDelete?: ((message: Message, onlyLocal: boolean) => void) | undefined;
  onStar?: ((message: Message) => void) | undefined;
  onOpenContact?: ((phone: string) => void) | undefined;
  searchTerm?: string | undefined;
  selectedMatchId?: string | undefined;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Rolagem dentro da conversa, nunca da pagina inteira. No SSR/jsdom
    // scrollIntoView nao existe e provocava falhas em alguns ambientes.
    const element = scroller.current;
    if (element && !searchTerm.trim()) element.scrollTop = element.scrollHeight;
    if (messages.length) reportMountedHistory(true);
  }, [messages.length]);

  useEffect(() => {
    if (!searchTerm.trim() || !selectedMatchId || !scroller.current) return;
    const container = scroller.current;
    const match = [...container.querySelectorAll<HTMLElement>("[data-search-message]")]
      .find((node) => node.dataset["searchMessage"] === selectedMatchId);
    if (match) container.scrollTop +=
      match.getBoundingClientRect().top - container.getBoundingClientRect().top - 70;
  }, [searchTerm, selectedMatchId]);

  return (
    <div ref={scroller} className="scroll-thin chat-wallpaper flex-1 overflow-y-auto py-4">
      <div className="mx-auto mb-3 flex w-fit max-w-md items-center gap-2 rounded-lg bg-panel-header px-3 py-1.5 text-center text-xs text-muted-foreground shadow-sm">
        <Lock className="h-3 w-3 shrink-0" /> As mensagens são protegidas com a criptografia de ponta a ponta.
      </div>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || new Date(prev.timestamp).toDateString() !== new Date(m.timestamp).toDateString();
        const tail = newDay || prev.fromMe !== m.fromMe;
        return (
          <Fragment key={m.id}>
            {newDay && (
              <div className="sticky top-1 z-10 my-3 flex justify-center">
                <span className="rounded-lg bg-panel-header px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground shadow-sm">
                  {formatDayLabel(m.timestamp)}
                </span>
              </div>
            )}
            <div data-search-message={m.id}>
              <MessageBubble message={m} tail={tail} onReply={onReply} onReact={onReact}
                onForward={onForward} onEdit={onEdit} onDelete={onDelete} onStar={onStar} onOpenContact={onOpenContact}
                highlight={searchTerm} selectedMatch={m.id === selectedMatchId} />
            </div>
          </Fragment>
        );
      })}

    </div>
  );
}
