import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, ImageIcon, LoaderCircle, Music2, Video, X, Maximize2 } from "lucide-react";
import { chatService } from "@/lib/chat/service";
import type { Message } from "@/lib/chat/types";

export function MediaView({ message }: { message: Message }) {
  const container = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const [src, setSrc] = useState("");
  const [mime, setMime] = useState("");
  const [textPreview, setTextPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isPdf = mime.toLowerCase().split(";")[0] === "application/pdf" ||
    (!mime && (message.mimetype === "application/pdf" || message.filename?.toLowerCase().endsWith(".pdf")));
  const picture = message.mediaType === "image" || message.mediaType === "sticker";
  // Só gerar miniatura automaticamente de PDFs pequenos.
  const thumbnail = picture || (message.isGif && (!message.fileSize || message.fileSize <= 8_000_000)) ||
    (isPdf && !!message.fileSize && message.fileSize <= 1_200_000);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => {
    if (!previewOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewOpen(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [previewOpen]);

  const download = useCallback(async (openPreview = false) => {
    if (running.current || src) return;
    running.current = true;
    setLoading(true);
    setError("");
    try {
      const data = await chatService.loadMedia(message.id);
      const decoded = atob(data.base64);
      const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
      const looksPdf = decoded.startsWith("%PDF-");
      const mime = (looksPdf && (!data.mimetype ||
        data.mimetype === "application/octet-stream")) ? "application/pdf" : data.mimetype;
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      setMime(mime);
      setSrc(url);
      const textFile = /^(text\/(plain|csv)|application\/(json|xml))$/.test(mime) &&
        bytes.byteLength < 250_000;
      if (textFile) setTextPreview(new TextDecoder("utf-8").decode(bytes));
      if (openPreview && (mime.startsWith("image/") || mime === "application/pdf" || textFile)) {
        setPreviewOpen(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mídia indisponível.");
    } finally {
      setLoading(false);
      running.current = false;
    }
  }, [message.id, src]);

  // Assim como o WhatsApp Web, imagens visíveis carregam automaticamente.
  // Não baixamos antecipadamente arquivos grandes, documentos ou áudios.
  useEffect(() => {
    if (!thumbnail || src || error || loading) return;
    const root = container.current;
    if (!root) return;
    if (typeof IntersectionObserver !== "function") {
      void download();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        void download();
      }
    }, { rootMargin: "250px" });
    observer.observe(root);
    return () => observer.disconnect();
  }, [thumbnail, src, error, loading, download]);

  const filename = message.filename || (message.mediaType === "document" ? "Documento" :
    message.isGif ? "GIF animado" : picture ? "Imagem" : message.mediaType === "video" ? "Vídeo" : "Áudio");
  return (
    <div ref={container} className="flex min-h-10 max-w-[min(320px,70vw)] flex-col gap-2">
      {!src && (
        <button type="button" onClick={() => void download(true)} disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border/40 bg-black/5 px-3 py-2 text-sm hover:bg-black/10 disabled:opacity-50">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> :
            picture ? <ImageIcon className="h-4 w-4" /> :
            isPdf ? <FileText className="h-5 w-5 text-red-500" /> :
            message.mediaType === "video" ? <Video className="h-4 w-4" /> :
            message.mediaType === "audio" || message.mediaType === "ptt" ?
              <Music2 className="h-4 w-4" /> : <FileText className="h-5 w-5" />}
          <span className="min-w-0 flex-1 truncate">
            <span className="block truncate font-semibold">{loading ? "Carregando..." : filename}</span>
            <span className="block text-[11px] text-muted-foreground">
              {isPdf ? "PDF • abrir sem baixar" : message.mediaType === "audio" ? "Áudio • ouvir" :
                message.mediaType === "video" ? "Vídeo • reproduzir" :
                message.fileSize ? (message.fileSize / 1024).toFixed(0) + " KB • visualizar" :
                "Clique para abrir"}
            </span>
          </span>
        </button>
      )}
      {src && mime.startsWith("image/") && (
        <button type="button" aria-label="Ampliar imagem na conversa" onClick={() => setPreviewOpen(true)}
          className="cursor-zoom-in text-left">
          <img src={src} alt={message.mediaType === "sticker" ? "Figurinha" : "Imagem recebida"}
            className={message.mediaType === "sticker" ? "max-h-40 max-w-40 object-contain" :
              "max-h-72 w-auto rounded-md object-contain"} />
        </button>
      )}
      {src && isPdf && (
        <button type="button" onClick={() => setPreviewOpen(true)}
          className="flex w-full flex-col overflow-hidden rounded-lg border text-left text-sm hover:bg-black/5">
          <iframe aria-hidden="true" tabIndex={-1} title="Miniatura do PDF"
            src={src + "#toolbar=0&navpanes=0&scrollbar=0&view=Fit"}
            className="pointer-events-none h-32 w-full border-0 bg-white" />
          <span className="flex w-full items-center gap-2 p-2">
            <FileText className="h-5 w-5 shrink-0 text-red-500" />
            <span className="min-w-0 flex-1 truncate">{filename}</span>
            <Maximize2 className="h-4 w-4 shrink-0" />
          </span>
        </button>
      )}
      {src && textPreview && (
        <button type="button" onClick={() => setPreviewOpen(true)}
          className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <FileText className="h-5 w-5" /> Visualizar texto sem baixar
        </button>
      )}
      {src && mime.startsWith("audio/") && <audio controls preload="none" src={src} className="max-w-full" />}
      {src && mime.startsWith("video/") && <video controls={!message.isGif}
        autoPlay={Boolean(message.isGif)} loop={Boolean(message.isGif)}
        muted={Boolean(message.isGif)} playsInline preload="metadata"
        src={src} className="max-h-72 max-w-full rounded-md" />}
      {src && <a href={src}
        download={message.filename || `arquivo-${message.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0,35)}`}
        className="inline-flex items-center gap-1 text-xs underline underline-offset-2">
        <FileText className="h-3.5 w-3.5" /> Baixar arquivo
      </a>}
      {previewOpen && src && typeof document !== "undefined" &&
        (mime.startsWith("image/") || isPdf || Boolean(textPreview)) && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Visualizar arquivo sem baixar"
          className="fixed inset-0 z-[200] flex flex-col bg-black/90 p-3"
          onClick={() => setPreviewOpen(false)}>
          <div className="mb-2 flex shrink-0 items-center justify-between gap-3 text-white"
            onClick={(event) => event.stopPropagation()}>
            <span className="min-w-0 truncate text-sm">{filename}</span>
            <div className="flex gap-3">
              <a href={src} download={filename} className="inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-2 text-sm">
                <Download className="h-4 w-4" /> Baixar
              </a>
              <button type="button" aria-label="Fechar visualização" onClick={() => setPreviewOpen(false)}
                className="rounded-md bg-white/15 p-2"><X className="h-5 w-5" /></button>
            </div>
          </div>
          {isPdf ? <iframe title="Leitor de PDF integrado" src={src}
            className="min-h-0 flex-1 rounded bg-white" onClick={(event) => event.stopPropagation()} />
            : textPreview ? <pre className="min-h-0 flex-1 overflow-auto rounded bg-white p-5 text-sm text-black"
                onClick={(event) => event.stopPropagation()}>{textPreview}</pre>
            : <div className="flex min-h-0 flex-1 items-center justify-center">
                <img src={src} alt="Imagem ampliada" onClick={(event) => event.stopPropagation()}
                  className="max-h-full max-w-full object-contain" />
              </div>}
        </div>,
        document.body
      )}
      {error && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-destructive" role="alert">{error}</span>
          <button type="button" onClick={() => void download(true)} className="text-left text-xs underline">
            Tentar baixar novamente
          </button>
        </div>
      )}
    </div>
  );
}
