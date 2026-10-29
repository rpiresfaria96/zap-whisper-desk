import { ContactRound, Paperclip, SendHorizontal, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { EmojiPicker } from "./EmojiPicker";
import type { Message } from "@/lib/chat/types";
import { X } from "lucide-react";


export function Composer({ onSend, onAttach, quoted, onCancelQuote, onShareContact, chatId }: {
  onSend: (text: string, quoted?: Message) => Promise<void>;
  onAttach: (file: File, caption?: string) => Promise<void>;
  quoted?: Message | null;
  onCancelQuote?: () => void;
  onShareContact?: (() => void) | undefined;
  chatId?: string | undefined;
}) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeAttachment, setActiveAttachment] = useState(0);
  const [progress, setProgress] = useState(0);
  const attachment = attachments[activeAttachment];
  const [captions, setCaptions] = useState<string[]>([]);
  const attachmentCaption = captions[activeAttachment] || "";
  const addFiles = (incoming: File[]) => {
    if (busy || !incoming.length) return;
    const available = Math.max(0, 10 - attachments.length);
    const hasGif = incoming.some((file) =>
      file.type.toLowerCase() === "image/gif" || file.name.toLowerCase().endsWith(".gif"));
    const allowed = incoming.filter((file) =>
      file.type.toLowerCase() !== "image/gif" &&
      !file.name.toLowerCase().endsWith(".gif") &&
      file.size <= 8 * 1024 * 1024).slice(0, available);
    if (hasGif)
      setError("O envio de GIF foi desativado. GIFs recebidos continuam visíveis.");
    else if (allowed.length < incoming.length)
      setError("Limite: 10 arquivos por envio e até 8 MB por arquivo.");
    else setError("");
    if (allowed.length) {
      setAttachments((previous) => [...previous, ...allowed]);
      setCaptions((previous) => [...previous, ...allowed.map(() => "")]);
    }
  };
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // O usuario solta anexos em qualquer area do Ideal-Zap, nao apenas no
  // rodape pequeno. Impede que o navegador tente abrir o arquivo em nova pagina.
  useEffect(() => {
    const isFile = (event: DragEvent) => Array.from(event.dataTransfer?.types || []).includes("Files");
    const over = (event: DragEvent) => {
      if (!isFile(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    };
    const leave = (event: DragEvent) => {
      if (!event.relatedTarget) setDragActive(false);
    };
    const drop = (event: DragEvent) => {
      if (!isFile(event)) return;
      event.preventDefault();
      setDragActive(false);
      addFiles(Array.from(event.dataTransfer?.files || []));
    };
    const stop = () => setDragActive(false);
    window.addEventListener("dragenter", over);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("dragenter", over);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("blur", stop);
    };
  }, [attachments.length, busy]);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!chatId) return;
    // Depois da montagem/troca de conversa, o cursor já está no campo.
    const frame = requestAnimationFrame(() => ta.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [chatId]);

  useEffect(() => {
    if (!attachment || !(attachment.type.startsWith("image/") ||
      attachment.type.startsWith("video/") || attachment.type === "application/pdf" ||
      attachment.name.toLowerCase().endsWith(".pdf"))) {
      setAttachmentPreview("");
      return;
    }
    const image = URL.createObjectURL(attachment);
    setAttachmentPreview(image);
    return () => URL.revokeObjectURL(image);
  }, [attachment]);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  async function send() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSend(value, quoted || undefined);
      if (quoted) onCancelQuote?.();
      setText("");
      setEmojiOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enviar mensagem.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAll() {
    if (busy || !attachments.length) return;
    if (attachments.some((file) => file.size > 8 * 1024 * 1024)) {
      setError("O limite de anexos nesta versão é 8 MB.");
      return;
    }
    setBusy(true);
    setError("");
    let successful = 0;
    try {
      for (const file of attachments) {
        setProgress(successful + 1);
        await onAttach(file, captions[successful] || "");
        successful++;
      }
      setAttachments([]);
      setCaptions([]);
      setActiveAttachment(0);
    } catch (cause) {
      setAttachments((items) => items.slice(successful));
      setCaptions((items) => items.slice(successful));
      setActiveAttachment(0);
      setError(cause instanceof Error ? cause.message : "Falha ao enviar anexo.");
    } finally { setBusy(false); setProgress(0); }
  }

  return (
    <footer className="relative shrink-0 bg-panel-header px-3 py-2.5">
      {dragActive && <div role="status" aria-label="Soltar arquivo"
        className="pointer-events-none fixed inset-3 z-[300] flex items-center justify-center rounded-2xl border-4 border-dashed border-primary bg-background/95 text-center text-xl font-semibold text-primary shadow-xl">
        Solte o arquivo para anexar à conversa
      </div>}
      {quoted && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border-l-4 border-primary bg-background/80 px-3 py-2">
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold text-primary">Respondendo mensagem</p>
            <p className="truncate text-muted-foreground">{quoted.body?.slice(0, 150) || "Arquivo"}</p>
          </div>
          <button type="button" aria-label="Cancelar resposta" onClick={onCancelQuote} className="rounded-md p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {attachment && (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex max-w-full flex-wrap items-center gap-1.5" aria-label="Arquivos selecionados">
            {attachments.map((file, index) => (
              <button key={index} type="button" disabled={busy}
                aria-pressed={index === activeAttachment}
                onClick={() => setActiveAttachment(index)}
                className={index === activeAttachment
                  ? "max-w-32 truncate rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                  : "max-w-32 truncate rounded-md bg-secondary px-2 py-1 text-xs"}>
                {index + 1}. {file.name}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-semibold">{attachment.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{(attachment.size / 1024).toFixed(0)} KB</span>
          </div>
          {attachmentPreview && attachment.type.startsWith("image/") &&
            <img src={attachmentPreview} alt="Prévia do arquivo a enviar"
              className="max-h-40 max-w-full self-center rounded object-contain" />}
          {attachmentPreview && attachment.type.startsWith("video/") &&
            <video src={attachmentPreview} controls preload="metadata"
              className="max-h-40 max-w-full self-center rounded" />}
          {attachmentPreview && (attachment.type === "application/pdf" ||
            attachment.name.toLowerCase().endsWith(".pdf")) &&
            <iframe title="Prévia do PDF antes de enviar"
              src={attachmentPreview + "#toolbar=0&view=Fit"}
              className="h-40 w-full rounded border bg-white" />}
          {!attachmentPreview && <p className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
            Documento pronto para envio. A visualização depende do formato.
          </p>}
          <input type="text" value={attachmentCaption} maxLength={1024}
            onChange={(event) => setCaptions((items) => items.map((value, index) => index === activeAttachment ? event.target.value : value))}
            placeholder="Legenda (opcional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAttachments([]); setCaptions([]); setActiveAttachment(0); }}
              disabled={busy} className="rounded-md border px-3 py-1.5 text-sm">Cancelar</button>
            <button type="button" onClick={() => void uploadAll()} disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? `Enviando ${progress}/${attachments.length}` : `Enviar ${attachments.length} arquivo(s)`}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive" role="alert">{error}</p>}
      {emojiOpen && <EmojiPicker onPick={(emoji) => {
        setText((previous) => previous + emoji);
        ta.current?.focus();
      }} />}
      <div className="flex items-end gap-1">
        <IconButton aria-label="Emojis" active={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)}><Smile /></IconButton>
        {onShareContact && <button type="button" aria-label="Enviar contato" title="Enviar cartão de contato"
          disabled={busy} onClick={onShareContact}
          className="flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-hover disabled:opacity-50">
          <ContactRound className="h-5 w-5" />
        </button>}
        <label title="Enviar anexo de até 8 MB" aria-label="Anexar arquivo"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-hover">
          <Paperclip className="h-5 w-5" />
          <input type="file" multiple className="sr-only" disabled={busy} onChange={(e) => {
            const picked = Array.from(e.currentTarget.files || []);
            e.currentTarget.value = "";
            addFiles(picked);
          }} />
        </label>
        <div className="flex min-h-10 flex-1 items-center rounded-xl bg-card px-4 py-2">
          <textarea
            ref={ta} rows={1} value={text} disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Digite uma mensagem"
            className="scroll-thin max-h-36 w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
        </div>
        <button type="button" aria-label="Enviar mensagem" title="Enviar mensagem"
          disabled={busy || !text.trim()} onClick={() => void send()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
          <SendHorizontal className="h-5 w-5" />
        </button>
      </div>
    </footer>
  );
}
