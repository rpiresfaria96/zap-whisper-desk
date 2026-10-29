import { Search, CheckCheck, Pin, RefreshCw, SquarePen, MailOpen, Mail, Archive, ArchiveRestore } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Chat, Message } from "@/lib/chat/types";
import { chatService } from "@/lib/chat/service";
import { formatListDate } from "@/lib/chat/format";
import { ContactAvatar } from "./ContactAvatar";
import { IconButton } from "./IconButton";

interface Props {
  title: string;
  chats: Chat[];
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRefresh: () => void;
  onMarkUnread: (id: string, unread: boolean) => Promise<void>;
  onArchive: (id: string, archive: boolean) => Promise<void>;
  onPin: (id: string, pinned: boolean) => Promise<void>;
  loading?: boolean;
  error?: string;
}

const filters = ["Tudo", "Não lidas", "Favoritas"] as const;

export function ChatList({ title, chats, selectedId, onSelect, onNewChat, onRefresh, onMarkUnread, onArchive, onPin, loading, error }: Props) {
  const [actionError, setActionError] = useState("");
  const runAction = async (kind: "unread" | "archive" | "pin", chat: Chat) => {
    setActionError("");
    try {
      if (kind === "unread") await onMarkUnread(chat.id, chat.unreadCount === 0);
      else if (kind === "archive") await onArchive(chat.id, !chat.archived);
      else await onPin(chat.id, !chat.pinned);
    } catch {
      setActionError("Não foi possível atualizar a conversa no WhatsApp.");
    }
  };
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Tudo");
  const pageSize = title === "Contatos" ? 36 : 90;
  const [visibleCount, setVisibleCount] = useState(90);
  useEffect(() => setVisibleCount(pageSize), [title, filter, q, pageSize]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return chats
      .filter((c) => !s || c.contact.name.toLowerCase().includes(s) ||
        c.contact.phone.includes(s) || c.lastMessage?.body?.toLowerCase().includes(s))
      .filter((c) => (filter === "Não lidas" ? c.unreadCount > 0 : filter === "Favoritas" ? c.favorite : true))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0));
  }, [chats, q, filter]);

  return (
    <section className="flex h-full w-full flex-col bg-panel">
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        <div className="flex gap-1">
          <IconButton aria-label="Atualizar lista" title="Buscar novas conversas" onClick={onRefresh}><RefreshCw /></IconButton>
          {title !== "Grupos" && <IconButton aria-label="Nova conversa" title="Nova conversa" onClick={onNewChat}><SquarePen /></IconButton>}
        </div>
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
      {actionError && <p role="alert" className="mx-4 mb-2 text-xs text-destructive">{actionError}</p>}
      {error && <div role="alert" className="mx-4 mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
        Não foi possível carregar: {error}
        <button className="ml-2 underline" type="button" onClick={onRefresh}>Tentar novamente</button>
      </div>}
      <ul className="scroll-thin flex-1 overflow-y-auto"
        onScroll={(event) => {
          const node = event.currentTarget;
          if (node.scrollTop + node.clientHeight >= node.scrollHeight - 300 &&
              visibleCount < list.length) {
            setVisibleCount((current) => Math.min(current + pageSize, list.length));
          }
        }}>
        {list.slice(0, visibleCount).map((chat) => (
          <ChatListItem key={chat.id} chat={chat} active={chat.id === selectedId}
            onClick={() => onSelect(chat.id)}
            onReadState={() => void runAction("unread", chat)}
            onArchive={() => void runAction("archive", chat)}
            onPin={() => void runAction("pin", chat)} showPreview={title !== "Contatos"} />
        ))}
        {list.length > visibleCount && (
          <li className="p-3 text-center">
            <button type="button" onClick={() => setVisibleCount((n) => Math.min(n + pageSize, list.length))}
              className="rounded-md border px-3 py-2 text-xs text-muted-foreground hover:bg-selected">
              Carregar mais ({Math.min(visibleCount, list.length)} de {list.length})
            </button>
          </li>
        )}
        {loading && <li className="p-5 text-sm text-muted-foreground" role="status">Sincronizando com o WhatsApp...</li>}
        {!loading && !error && list.length === 0 && (
          <li className="p-8 text-center text-sm text-muted-foreground">
            Nada para mostrar. Verifique se a sincronização do WhatsApp terminou ou atualize a lista.
          </li>
        )}
      </ul>
    </section>
  );
}

function ChatListItem({ chat, active, onClick, onReadState, onArchive, onPin, showPreview }: {
  chat: Chat; active: boolean; onClick: () => void;
  onReadState: () => void; onArchive: () => void; onPin: () => void; showPreview: boolean;
}) {
  const element = useRef<HTMLLIElement>(null);
  const [preview, setPreview] = useState<Message | null>(null);
  const attempted = useRef(false);
  useEffect(() => {
    attempted.current = false;
    setPreview(null);
  }, [chat.id]);
  useEffect(() => {
    if (!showPreview || chat.lastMessage?.body || attempted.current) return;
    const load = async () => {
      if (attempted.current) return;
      attempted.current = true;
      try { setPreview(await chatService.getPreview(chat.id)); }
      catch { /* Se indisponivel, mostrar texto neutro na lista. */ }
    };
    if (typeof IntersectionObserver !== "function" || !element.current) {
      void load();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((item) => item.isIntersecting)) {
        observer.disconnect();
        void load();
      }
    }, { rootMargin: "130px" });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [chat.id, chat.lastMessage?.body, showPreview]);
  const m = chat.lastMessage?.body ? chat.lastMessage : preview || chat.lastMessage;
  const summary = m?.body || (m?.mediaType ? "[Mídia]" : "Abra para ver as mensagens");
  return (
    <li ref={element} className="group relative">
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
              <span className="truncate">{summary}</span>
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
      <div className="absolute right-3 top-1 z-10 hidden gap-1 group-hover:flex group-focus-within:flex">
        <button type="button" onClick={onPin} title={chat.pinned ? "Desafixar conversa" : "Fixar conversa"}
          className="rounded-md bg-panel-header p-1.5 shadow-sm">
          <Pin className={cn("h-4 w-4", chat.pinned && "fill-primary text-primary")} />
        </button>
        <button type="button" onClick={onReadState} title={chat.unreadCount ? "Marcar como lida" : "Marcar como não lida"}
          className="rounded-md bg-panel-header p-1.5 shadow-sm">
          {chat.unreadCount ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onArchive} title={chat.archived ? "Desarquivar" : "Arquivar conversa"}
          className="rounded-md bg-panel-header p-1.5 shadow-sm">
          {chat.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
      </div>
    </li>
  );
}
