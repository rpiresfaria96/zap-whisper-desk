import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Search, X } from "lucide-react";
import type { Chat, Message } from "@/lib/chat/types";
import { ContactAvatar } from "./ContactAvatar";
import { cn } from "@/lib/utils";

const validDestination = (id: string) =>
  /^[0-9]{7,15}@c\.us$/.test(id) ||
  /^[0-9]{7,30}@lid$/.test(id) ||
  /^[0-9-]{7,45}@g\.us$/.test(id);

export function ForwardDialog({ message, chats, contacts, groups, onCancel, onForward }: {
  message: Message;
  chats: Chat[];
  contacts: Chat[];
  groups: Chat[];
  onCancel: () => void;
  onForward: (ids: string[]) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const options = useMemo(() => {
    const uniq = new Map<string, Chat>();
    // Conversas recentes primeiro, depois grupos e agenda salva.
    for (const chat of [...chats, ...groups, ...contacts]) {
      if (validDestination(chat.id) && !uniq.has(chat.id)) uniq.set(chat.id, chat);
    }
    return [...uniq.values()];
  }, [chats, contacts, groups]);

  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return options.slice(0, 70);
    const digits = term.replace(/\D/g, "");
    return options.filter((chat) =>
      chat.contact.name.toLocaleLowerCase("pt-BR").includes(term) ||
      (digits.length >= 2 && chat.contact.phone.replace(/\D/g, "").includes(digits)) ||
      chat.id.includes(term)).slice(0, 90);
  }, [options, query]);

  const addNumber = () => {
    const number = query.replace(/\D/g, "");
    if (number.length < 7 || number.length > 15) {
      setError("Digite telefone com DDI, somente números.");
      return;
    }
    toggle(number + "@c.us");
    setQuery("");
  };

  const toggle = (id: string) => {
    setError("");
    setSelected((previous) => {
      if (previous.includes(id)) return previous.filter((item) => item !== id);
      if (previous.length >= 5) {
        setError("Escolha no máximo 5 conversas por encaminhamento.");
        return previous;
      }
      return [...previous, id];
    });
  };

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => { if (event.key === "Escape" && !sending) onCancel(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onCancel, sending]);

  const submit = async () => {
    if (!selected.length || sending) return;
    setError("");
    setSending(true);
    try { await onForward(selected); onCancel(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao encaminhar."); }
    finally { setSending(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Encaminhar mensagem"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) onCancel(); }}
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-3">
      <div className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Encaminhar mensagem</h2>
          <button type="button" onClick={onCancel} disabled={sending}
            aria-label="Fechar encaminhamento" className="rounded-full p-2 hover:bg-secondary">
            <X className="h-5 w-5" /></button>
        </div>
        <div className="mx-4 mt-3 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
          <span className="line-clamp-2">{message.mediaType ? "📎 " + (message.filename || "Arquivo") :
            message.body.slice(0, 180)}</span>
        </div>
        <label className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
          <Search className="h-4 w-4 shrink-0" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar nome, grupo ou telefone com DDI"
            className="w-full bg-transparent text-sm outline-none" />
        </label>
        <div className="mt-2 flex-1 overflow-y-auto px-2" role="list" aria-label="Destinos">
          {matches.map((chat) =>
            <button key={chat.id} type="button" role="listitem"
              aria-pressed={selected.includes(chat.id)}
              onClick={() => toggle(chat.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary">
              <ContactAvatar contact={chat.contact} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{chat.contact.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {chat.id.endsWith("@g.us") ? "Grupo" : chat.contact.phone || "Contato"}
                </p>
              </div>
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                selected.includes(chat.id) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50")}>
                {selected.includes(chat.id) && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>)}
          {!matches.length && <p className="p-4 text-center text-sm text-muted-foreground">
            Nenhum contato encontrado.
          </p>}
          {!!query.trim() && /^\+?[\d\s()-]{7,24}$/.test(query.trim()) &&
            <button type="button" onClick={addNumber}
              className="my-2 w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-secondary">
              Encaminhar para número com DDI: {query.trim()}
            </button>}
        </div>
        {error && <p role="alert" className="mx-4 my-2 text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <span className="flex-1 text-sm text-muted-foreground">
            {selected.length ? `${selected.length} de 5 selecionados` : "Selecione os destinatários"}
          </span>
          <button type="button" onClick={() => void submit()} disabled={!selected.length || sending}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {sending ? "Encaminhando..." : "Encaminhar"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
