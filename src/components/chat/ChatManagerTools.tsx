import { useCallback, useEffect, useState } from "react";
import { Download, Images, Tags, Users, X } from "lucide-react";
import { MediaView } from "./MediaView";
import { chatService } from "@/lib/chat/service";
import type { Chat, ChatLabel, GroupDetails, Message } from "@/lib/chat/types";

interface Props {
  chat: Chat;
  messages: Message[];
  onClose: () => void;
}

export function ChatManagerTools({ chat, messages, onClose }: Props) {
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [labels, setLabels] = useState<ChatLabel[]>([]);
  const [groupError, setGroupError] = useState("");
  const [labelError, setLabelError] = useState("");
  const [notice, setNotice] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "document" | "audio">("all");
  const mediaItems = messages.filter((message) => Boolean(message.mediaType) &&
    (mediaFilter === "all" ||
      (mediaFilter === "image" && ["image", "sticker", "video"].includes(message.mediaType || "")) ||
      (mediaFilter === "document" && message.mediaType === "document") ||
      (mediaFilter === "audio" && ["audio", "ptt"].includes(message.mediaType || ""))));

  const [busy, setBusy] = useState(false);
  const isGroup = chat.id.endsWith("@g.us");

  const getLabels = useCallback(async () => {
    try { setLabels(await chatService.listLabels()); setLabelError(""); }
    catch { setLabelError("Etiquetas indisponíveis nesta conta ou sessão."); }
  }, []);

  useEffect(() => {
    void getLabels();
    if (isGroup) {
      void chatService.groupDetails(chat.id).then(setGroup)
        .catch(() => setGroupError("O servidor não retornou informações deste grupo."));
    }
  }, [chat.id, isGroup, getLabels]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const execute = async (work: () => Promise<void>, success: string) => {
    setNotice("");
    setBusy(true);
    try { await work(); setNotice(success); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Ação indisponível."); }
    finally { setBusy(false); }
  };

  const exportLoaded = () => {
    // Exportação inteiramente local, sob clique explícito; o backend não
    // armazena nem registra o conteúdo exportado.
    const history = messages.map((message) => {
      const date = new Date(message.timestamp).toLocaleString("pt-BR");
      const speaker = message.fromMe ? "Você" : chat.contact.name;
      return `[${date}] ${speaker}: ${message.body.replace(/[\r\n]+/g, " ")}`;
    }).join("\r\n");
    const blob = new Blob([
      "Ideal-Zap — exportação de mensagens carregadas (não é histórico completo)\r\n\r\n",
      history,
    ], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ideal-zap-conversa-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Ferramentas da conversa"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-3">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Ferramentas da conversa</h2>
            <p className="truncate text-sm text-muted-foreground">{chat.contact.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy}
            aria-label="Fechar ferramentas" className="rounded-full p-2 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto p-4">
          {isGroup && <section className="space-y-2 border-t pt-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" /> Informações do grupo
            </h3>
            {groupError && <p role="alert" className="text-sm text-destructive">{groupError}</p>}
            {group && <>
              <p className="text-sm font-medium">{group.name || chat.contact.name}</p>
              {group.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{group.description}</p>}
              <p className="text-xs text-muted-foreground">{group.count} participante(s)</p>
              <div className="max-h-32 space-y-1 overflow-y-auto text-xs">
                {group.participants.map((person) => <p key={person.id} className="truncate">
                  {person.id}{person.admin ? " · administrador" : ""}
                </p>)}
              </div>
            </>}
          </section>}
          <section className="space-y-2 border-t pt-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Tags className="h-4 w-4" /> Etiquetas do WhatsApp Business
            </h3>
            {labelError && <p role="alert" className="text-sm text-muted-foreground">{labelError}</p>}
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {labels.map((label) => <div key={label.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{label.name}</span>
                <button type="button" disabled={busy} className="text-xs font-semibold text-primary disabled:opacity-50"
                  onClick={() => void execute(() => chatService.setChatLabel(chat.id, label.id, "add"),
                    "Solicitação para adicionar etiqueta enviada.")}>Adicionar</button>
                <button type="button" disabled={busy} className="text-xs underline disabled:opacity-50"
                  onClick={() => void execute(() => chatService.setChatLabel(chat.id, label.id, "remove"),
                    "Solicitação para remover etiqueta enviada.")}>Remover</button>
              </div>)}
            </div>
            <form onSubmit={(event) => {
              event.preventDefault();
              if (!newLabel.trim()) return;
              void execute(async () => { await chatService.createLabel(newLabel.trim()); setNewLabel(""); await getLabels(); },
                "Etiqueta criada no WhatsApp.");
            }} className="flex gap-2">
              <input type="text" maxLength={70} value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)} placeholder="Nova etiqueta"
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
              <button type="submit" disabled={busy || !newLabel.trim()}
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40">
                Criar
              </button>
            </form>
          </section>
          <section className="space-y-2 border-t pt-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Images className="h-4 w-4" /> Mídia e arquivos compartilhados
            </h3>
            <p className="text-xs text-muted-foreground">
              Apenas anexos encontrados nas {messages.length} mensagens já carregadas.
            </p>
            <div className="flex flex-wrap gap-1">
              {([
                ["all", "Todos"], ["image", "Imagens / vídeos"],
                ["document", "Documentos"], ["audio", "Áudios"],
              ] as const).map(([key, label]) =>
                <button key={key} type="button" aria-pressed={mediaFilter === key}
                  onClick={() => setMediaFilter(key)}
                  className={mediaFilter === key
                    ? "rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                    : "rounded-full bg-secondary px-3 py-1.5 text-xs"}>
                  {label}</button>)}
            </div>
            {!mediaItems.length && <p className="text-xs text-muted-foreground">
              Nenhum arquivo desse tipo nas mensagens carregadas.
            </p>}
            <div className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {mediaItems.slice(-18).reverse().map((message) =>
                <div key={message.id} className="min-w-0 rounded-lg border p-2">
                  <MediaView message={message} />
                </div>)}
            </div>
            {mediaItems.length > 18 && <p className="text-xs text-muted-foreground">
              Exibindo os 18 arquivos mais recentes nesta categoria.
            </p>}
          </section>
          <section className="space-y-2 border-t pt-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Download className="h-4 w-4" /> Exportar conversa
            </h3>
            <p className="text-xs text-muted-foreground">
              Exporta apenas as {messages.length} mensagens já carregadas em TXT;
              não inclui anexos nem todo o histórico.
            </p>
            <button type="button" disabled={!messages.length}
              onClick={exportLoaded} className="rounded-lg border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50">
              Exportar mensagens carregadas
            </button>
          </section>
          {notice && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{notice}</p>}
        </div>
      </div>
    </div>
  );
}
