import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/chat/types";
import { formatTime } from "@/lib/chat/format";

export function MessageBubble({ message, tail }: { message: Message; tail: boolean }) {
  const out = message.fromMe;
  return (
    <div className={cn("bubble-in-enter flex px-[6%]", out ? "justify-end" : "justify-start", tail ? "mt-2" : "mt-0.5")}>
      <div
        className={cn(
          "relative max-w-[min(65%,560px)] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14.5px] leading-snug text-bubble-foreground shadow-[0_1px_0.5px_oklch(0_0_0/0.13)]",
          out ? "bg-bubble-out" : "bg-bubble-in",
          tail && (out ? "rounded-tr-none" : "rounded-tl-none"),
        )}
      >
        {tail && (
          <svg
            viewBox="0 0 8 13"
            className={cn("absolute top-0 h-[13px] w-2", out ? "-right-2 text-bubble-out" : "-left-2 -scale-x-100 text-bubble-in")}
          >
            <path fill="currentColor" d="M0 0h8L1.5 9.5C1 10.3 0 10 0 9V0z" />
          </svg>
        )}
        <span className="whitespace-pre-wrap break-words">{message.body}</span>
        <span className="float-right ml-3 mt-1.5 flex translate-y-1 items-center gap-1 text-[11px] text-muted-foreground">
          {formatTime(message.timestamp)}
          {out && <StatusIcon status={message.status} />}
        </span>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status?: Message["status"] }) {
  if (status === "sending") return <Clock className="h-3.5 w-3.5" />;
  if (status === "sent") return <Check className="h-4 w-4" />;
  return <CheckCheck className={cn("h-4 w-4", status === "read" && "text-tick-read")} />;
}
