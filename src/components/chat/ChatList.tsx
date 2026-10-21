import { Search, CheckCheck, Pin, SquarePen } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Chat } from "@/lib/chat/types";
import { formatListDate } from "@/lib/chat/format";
import { ContactAvatar } from "./ContactAvatar";
import { IconButton } from "./IconButton";

interface Props {
  title: string;
  chats: Chat[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

const filters = ["Tudo", "Não lidas", "Favoritas"] as const;

export function ChatList({ title, chats, selectedId, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Tudo");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return chats
      .filter((c) => !s || c.contact.name.toLowerCase().includes(s) || c.contact.phone.includes(s))
      .filter((c) => (filter === "Não lidas" ? c.unreadCount > 0 : filter === "Favoritas" ? c.favorite : true))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0));
  }, [chats, q, filter]);

  return (
    <section className="flex h-full w-full flex-col bg-panel">
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        <IconButton aria-label="Nova conversa"><SquarePen /></IconButton>
      </header>
      <div className="px-4 pb-2">
        <label className="flex items-center gap-3 rounded-full bg-input px-4 py-2 transition focus-within:ring-2 focus-within:ring-ring/40">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar ou começar nova conversa"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <div className="flex gap-2 px-4 pb-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
              filter === f ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:bg-selected",
            )}
          >
            {f}
          </button>
        ))}
      </div>
      <ul className="scroll-thin flex-1 overflow-y-auto">
        {list.map((chat) => (
          <ChatListItem key={chat.id} chat={chat} active={chat.id === selectedId} onClick={() => onSelect(chat.id)} />
        ))}
        {list.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</li>}
      </ul>
    </section>
  );
}

function ChatListItem({ chat, active, onClick }: { chat: Chat; active: boolean; onClick: () => void }) {
  const m = chat.lastMessage;
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          active ? "bg-selected" : "hover:bg-hover",
        )}
      >
        <ContactAvatar contact={chat.contact} size={48} />
        <div className="min-w-0 flex-1 border-b border-border/60 pb-3 -mb-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-semibold">{chat.contact.name}</span>
            {m && (
              <span className={cn("shrink-0 text-xs", chat.unreadCount ? "font-semibold text-primary" : "text-muted-foreground")}>
                {formatListDate(m.timestamp)}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm text-muted-foreground">
              {m?.fromMe && <CheckCheck className={cn("h-4 w-4 shrink-0", m.status === "read" && "text-tick-read")} />}
              <span className="truncate">{m?.body}</span>
            </p>
            {chat.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {chat.unreadCount > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground animate-in zoom-in-50">
                {chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}
