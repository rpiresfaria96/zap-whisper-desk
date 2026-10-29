import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ContactRound, Search, Send, UserRound, X } from "lucide-react";
import type { Chat } from "@/lib/chat/types";
import { ContactAvatar } from "./ContactAvatar";

interface Props {
  contacts: Chat[];
  onLoad: () => void;
  onSend: (id: string, name: string) => Promise<void>;
  onClose: () => void;
}

interface ShareContact { id: string; name: string; phone: string; source?: Chat | undefined }

export function ContactShareDialog({ contacts, onLoad, onSend, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ShareContact | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    onLoad();
  }, [onLoad]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) {
        if (reviewing) setReviewing(false); else onClose();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose, sending, reviewing]);

  const choices = useMemo(() => {
    const unique = new Map<string, ShareContact>();
    for (const entry of contacts) {
      const fromId = /^([0-9]{7,15})@c\.us$/.exec(entry.id)?.[1];
      const fromPhone = entry.contact.phone.replace(/\D/g, "");
      const digits = fromId || (/^[0-9]{7,15}$/.test(fromPhone) ? fromPhone : "");
      if (!digits) continue;
      const id = digits + "@c.us";
      const name = entry.contact.name || "+" + digits;
      if (!unique.has(id)) unique.set(id, {
        id, name, phone: "+" + digits, source: entry,
      });
    }
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const digits = term.replace(/\D/g, "");
    return [...unique.values()].filter((item) => !term ||
      item.name.toLocaleLowerCase("pt-BR").includes(term) ||
      (digits.length >= 2 && item.phone.includes(digits))).slice(0, 70);
  }, [contacts, search]);

  const chooseManual = () => {
    const digits = manualPhone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15 || !manualName.trim()) {
      setError("Informe nome e telefone com DDI para compartilhar.");
      return;
    }
    setSelected({ id: digits + "@c.us", name: manualName.trim().slice(0, 120), phone: "+" + digits });
    setError("");
    setReviewing(true);
  };

  const submit = async () => {
    if (!selected || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(selected.id, selected.name);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível compartilhar o contato.");
    } finally { setSending(false); }
  };

  return <div role="dialog" aria-modal="true" aria-label="Enviar contato"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !sending) onClose();
    }}
    className="fixed inset-0 z-[185] flex items-center justify-center bg-black/60 p-3">
    <div className="flex max-h-[min(90vh,740px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
      <header className="flex items-center gap-3 border-b px-4 py-4">
        {reviewing
          ? <button type="button" aria-label="Voltar à lista de contatos" onClick={() => setReviewing(false)}
              className="rounded-full p-2 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
          : <ContactRound className="h-5 w-5 text-primary" />}
        <h2 className="min-w-0 flex-1 text-lg font-semibold">{reviewing ? "Prévia do contato" : "Enviar contato"}</h2>
        <button type="button" aria-label="Fechar" onClick={onClose} disabled={sending}
          className="rounded-full p-2 hover:bg-secondary disabled:opacity-50"><X className="h-5 w-5" /></button>
      </header>

      {!reviewing ? <>
        <label className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar contatos" aria-label="Pesquisar contatos"
            className="w-full bg-transparent text-sm outline-none" />
        </label>
        <p className="px-5 pb-2 pt-3 text-xs text-muted-foreground">CONTATOS</p>
        <div className="min-h-[180px] flex-1 overflow-y-auto px-3 pb-3">
          {choices.map((item) => <button type="button" key={item.id}
              aria-pressed={selected?.id === item.id}
              onClick={() => { setSelected(item); setManualOpen(false); setError(""); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary">
              {item.source
                ? <ContactAvatar contact={item.source.contact} size={40} />
                : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <UserRound className="h-5 w-5" /></div>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.phone}</span>
              </span>
              <span className={selected?.id === item.id
                  ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  : "h-5 w-5 rounded-full border-2 border-muted-foreground/50"}>
                {selected?.id === item.id && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>)}
          {!choices.length && <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nenhum contato com telefone disponível nesta busca.
          </p>}
          <button type="button" onClick={() => { setManualOpen(!manualOpen); setSelected(null); }}
            className="my-2 w-full rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-secondary">
            {manualOpen ? "Ocultar número manual" : "+ Compartilhar número não salvo"}
          </button>
          {manualOpen && <div className="space-y-2 rounded-xl bg-secondary/50 p-3">
            <input aria-label="Nome do contato não salvo" value={manualName}
              maxLength={120} onChange={(e) => setManualName(e.target.value)}
              placeholder="Nome do contato"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            <input aria-label="Telefone com DDI" type="tel" value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="Telefone com DDI (ex.: 5565999999999)"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
            <button type="button" onClick={chooseManual} className="rounded-lg border bg-card px-3 py-2 text-sm">
              Visualizar contato
            </button>
          </div>}
        </div>
      </> : selected && <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
          {selected.source
            ? <ContactAvatar contact={selected.source.contact} size={96} />
            : <UserRound className="h-12 w-12 text-muted-foreground" />}
        </div>
        <p className="max-w-full truncate text-xl font-semibold">{selected.name}</p>
        <p className="text-sm text-muted-foreground">{selected.phone}</p>
        <div className="mt-3 w-full max-w-sm rounded-xl border bg-secondary/40 px-4 py-3 text-left">
          <span className="text-xs font-semibold text-primary">Contato do WhatsApp</span>
          <p className="mt-1 truncate text-sm">{selected.name}</p>
          <p className="truncate text-xs text-muted-foreground">{selected.phone}</p>
        </div>
      </div>}

      {error && <p role="alert" className="px-5 pb-2 text-sm text-destructive">{error}</p>}
      <footer className="flex items-center justify-between border-t px-5 py-4">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {selected ? selected.name : "Selecione um contato"}
        </p>
        {reviewing
          ? <button type="button" disabled={!selected || sending} onClick={() => void submit()}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              <Send className="h-4 w-4" /> {sending ? "Enviando..." : "Enviar contato"}
            </button>
          : <button type="button" disabled={!selected} onClick={() => setReviewing(true)}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              Avançar <ArrowRight className="h-4 w-4" />
            </button>}
      </footer>
    </div>
  </div>;
}
