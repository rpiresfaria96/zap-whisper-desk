import { Fragment, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import type { Message } from "@/lib/chat/types";
import { formatDayLabel } from "@/lib/chat/format";
import { MessageBubble } from "./MessageBubble";

export function MessageList({ messages }: { messages: Message[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);

  return (
    <div className="scroll-thin chat-wallpaper flex-1 overflow-y-auto py-4">
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
            <MessageBubble message={m} tail={tail} />
          </Fragment>
        );
      })}
      <div ref={end} />
    </div>
  );
}
