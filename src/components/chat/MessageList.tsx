import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
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
  searchTerm = "", selectedMatchId, chatId }: {
  messages: Message[];
  chatId?: string | undefined;
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
  const content = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const openedChat = useRef<string | undefined>(undefined);
  const currentSearch = useRef(searchTerm);
  currentSearch.current = searchTerm;

  // On chat change always show newest messages, even when both chats have
  // exactly 80 messages. Otherwise follow only if the reader was near bottom.
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    if (openedChat.current !== chatId) {
      openedChat.current = chatId;
      followBottom.current = true;
    }
    if (!searchTerm.trim() && followBottom.current) node.scrollTop = node.scrollHeight;
  }, [chatId, messages, searchTerm]);

  // Media previews/images can grow after the first render. Only follow their
  // height changes if the reader did not intentionally scroll up.
  useEffect(() => {
    const element = content.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (followBottom.current && !currentSearch.current.trim() && scroller.current) {
        scroller.current.scrollTop = scroller.current.scrollHeight;
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (messages.length) reportMountedHistory(true);
  }, [chatId, messages.length]);

  useEffect(() => {
    if (!searchTerm.trim() || !selectedMatchId || !scroller.current) return;
    const container = scroller.current;
    const match = [...container.querySelectorAll<HTMLElement>("[data-search-message]")]
      .find((node) => node.dataset["searchMessage"] === selectedMatchId);
    if (match) container.scrollTop +=
      match.getBoundingClientRect().top - container.getBoundingClientRect().top - 70;
  }, [searchTerm, selectedMatchId]);

  return (
    <div ref={scroller} onScroll={(event) => {
      const element = event.currentTarget;
      followBottom.current = element.scrollHeight - element.clientHeight - element.scrollTop < 120;
    }} className="scroll-thin chat-wallpaper flex-1 min-h-0 overflow-y-auto py-4">
      <div ref={content}>
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
    </div>
  );
}
