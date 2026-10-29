import { Check, CheckCheck, Clock, Reply, SmilePlus, MoreHorizontal, Forward, Pencil, Trash2, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { chatService } from "@/lib/chat/service";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/chat/types";
import { formatTime } from "@/lib/chat/format";
import { MediaView } from "./MediaView";
import { FormattedMessage } from "./FormattedMessage";

interface Props {
  message: Message;
  tail: boolean;
  highlight?: string | undefined;
  selectedMatch?: boolean | undefined;
  onReply?: ((message: Message) => void) | undefined;
  onReact?: ((message: Message, emoji: string) => void) | undefined;
  onForward?: ((message: Message) => void) | undefined;
  onEdit?: ((message: Message) => void) | undefined;
  onDelete?: ((message: Message, onlyLocal: boolean) => void) | undefined;
  onStar?: ((message: Message) => void) | undefined;
  onOpenContact?: ((phone: string) => void) | undefined;
}

export function MessageBubble({ message, tail, highlight = "", selectedMatch, onReply,
  onReact, onForward, onEdit, onDelete, onStar, onOpenContact }: Props) {
  const out = message.fromMe;
  const [reacting, setReacting] = useState(false);
  const [menu, setMenu] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu && !reacting) return;
    const dismiss = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setMenu(false);
        setReacting(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenu(false); setReacting(false); }
    };
    window.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("keydown", escape);
    };
  }, [menu, reacting]);
  const [savingContact, setSavingContact] = useState(false);
  const [contactResult, setContactResult] = useState("");
  const saveContactCard = async () => {
    const card = message.contactCard;
    if (!card || savingContact || !/^\+[0-9]{7,15}$/.test(card.phone)) return;
    setSavingContact(true); setContactResult("");
    try {
      await chatService.savePhoneContact(card.phone, card.name);
      setContactResult("Contato salvo no WhatsApp. Sincronização com a agenda do telefone solicitada.");
    } catch (error) {
      setContactResult(error instanceof Error ? error.message : "Não foi possível salvar no telefone.");
    } finally { setSavingContact(false); }
  };
  const choice = (callback?: () => void) => {
    callback?.();
    setMenu(false);
    setReacting(false);
  };
  return (
    <div className={cn("bubble-in-enter flex px-[6%]", out ? "justify-end" : "justify-start",
      tail ? "mt-2" : "mt-0.5")}>
      <div ref={bubbleRef} className={cn(
        "relative max-w-[min(75%,600px)] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14.5px] leading-snug text-bubble-foreground shadow-[0_1px_0.5px_oklch(0_0_0/0.13)]",
        out ? "bg-bubble-out" : "bg-bubble-in",
        tail && (out ? "rounded-tr-none" : "rounded-tl-none"),
        selectedMatch && "ring-2 ring-orange-500",
        !!message.reactions?.length && "mb-3",
      )}>
        {tail && <svg viewBox="0 0 8 13"
          className={cn("absolute top-0 h-[13px] w-2", out ? "-right-2 text-bubble-out" : "-left-2 -scale-x-100 text-bubble-in")}>
          <path fill="currentColor" d="M0 0h8L1.5 9.5C1 10.3 0 10 0 9V0z" />
        </svg>}
        {message.quotedId && <div className="mb-1 rounded border-l-[3px] border-primary bg-black/5 px-2 py-1 text-xs text-muted-foreground">
          <span className="block font-semibold">Em resposta a uma mensagem</span>
          <span className="line-clamp-2">{message.quotedText || "Mensagem citada"}</span>
        </div>}
        {message.contactCard && !message.deleted && <div className="mb-1 min-w-56 rounded-lg border bg-card/50 p-3">
          <p className="text-xs font-semibold text-primary">Contato compartilhado</p>
          <p className="mt-1 truncate font-semibold">{message.contactCard.name}</p>
          {message.contactCard.phone && <p className="truncate text-xs text-muted-foreground">{message.contactCard.phone}</p>}
          {/^\+[0-9]{7,15}$/.test(message.contactCard.phone) ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-2">
              <button type="button" onClick={() => onOpenContact?.(message.contactCard!.phone)}
                disabled={!onOpenContact} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                Conversar
              </button>
              <button type="button" onClick={() => void saveContactCard()} disabled={savingContact}
                className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                {savingContact ? "Salvando..." : "Salvar no telefone"}
              </button>
            </div>
          ) : <p className="mt-2 text-xs text-muted-foreground">
            Este cartão veio sem número legível; não é possível abrir a conversa.
          </p>}
        </div>}
        {!message.deleted && message.mediaType && <MediaView key={message.id} message={message} />}
        {message.body && !message.contactCard && (!message.mediaType ||
          !/^\[(Imagem|Vídeo|Áudio|Arquivo|Documento|Figurinha|Mídia)\]$/.test(message.body)) &&
          <FormattedMessage text={message.body} highlight={highlight} />}
        {!!message.reactions?.length && <div aria-label="Reações"
          className={cn("absolute -bottom-2.5 z-10 flex items-center gap-0.5 rounded-full border border-border/60 bg-card px-1.5 py-0.5 text-sm shadow-sm",
            out ? "left-2" : "right-2")}>
          {message.reactions.map((emoji, index) =>
            <span key={index} className="leading-none">{emoji}</span>)}
        </div>}
        <div className="relative mt-1 flex items-center justify-between gap-2">
          <div ref={controlsRef} className="flex items-center gap-0.5">
            {!message.deleted && onReply && <button type="button" title="Responder citando mensagem"
              onClick={() => choice(() => onReply(message))} className="rounded p-1 text-muted-foreground hover:bg-black/10">
              <Reply className="h-3.5 w-3.5" /></button>}
            {!message.deleted && onReact && <button type="button" title="Reagir com emoji"
              onClick={() => setReacting(!reacting)}
              className="rounded p-1 text-muted-foreground hover:bg-black/10">
              <SmilePlus className="h-3.5 w-3.5" /></button>}
            {onStar && <button type="button" title={message.starred ? "Remover dos favoritos" : "Favoritar mensagem"}
              onClick={() => choice(() => onStar(message))}
              className="rounded p-1 text-muted-foreground hover:bg-black/10">
              <Star className={cn("h-3.5 w-3.5", message.starred && "fill-yellow-400 text-yellow-500")} />
            </button>}
            {(onForward || onEdit || onDelete) && <button type="button"
              aria-label="Mais ações da mensagem" title="Mais ações"
              onClick={() => setMenu(!menu)}
              className="rounded p-1 text-muted-foreground hover:bg-black/10">
              <MoreHorizontal className="h-4 w-4" /></button>}
            {reacting && onReact && <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-lg border bg-card p-1 shadow-lg">
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) =>
                <button type="button" key={emoji} onClick={() => choice(() => onReact(message, emoji))}
                  className="rounded p-1 text-base hover:bg-black/10" title={`Reagir ${emoji}`}>{emoji}</button>)}
            </div>}
            {menu && <div className="absolute bottom-full left-0 z-20 mb-1 min-w-40 rounded-lg border bg-card p-1 shadow-lg">
              {onStar && <button type="button"
                onClick={() => choice(() => onStar(message))}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-secondary">
                <Star className="h-4 w-4" /> {message.starred ? "Desfavoritar" : "Favoritar"}
              </button>}
              {onForward && <button type="button" onClick={() => choice(() => onForward(message))}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-secondary">
                <Forward className="h-4 w-4" /> Encaminhar
              </button>}
              {out && !message.deleted && onEdit && <button type="button"
                onClick={() => choice(() => onEdit(message))}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-secondary">
                <Pencil className="h-4 w-4" /> Editar
              </button>}
              {onDelete && !message.deleted && <button type="button"
                onClick={() => choice(() => onDelete(message, true))}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-secondary">
                <Trash2 className="h-4 w-4" /> Apagar para mim
              </button>}
              {out && onDelete && !message.deleted && <button type="button"
                onClick={() => choice(() => onDelete(message, false))}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-secondary">
                <Trash2 className="h-4 w-4" /> Apagar para todos
              </button>}
            </div>}
          </div>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {message.edited && <span className="text-[10px] italic">Editada</span>}
            {message.starred && <Star aria-label="Mensagem favorita" className="h-3 w-3 fill-yellow-400 text-yellow-500" />}
            {formatTime(message.timestamp)} {out && <StatusIcon status={message.status} />}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status?: Message["status"] }) {
  if (status === "sending") return <Clock className="h-3.5 w-3.5" />;
  if (status === "sent") return <Check className="h-4 w-4" />;
  return <CheckCheck className={cn("h-4 w-4", status === "read" && "text-tick-read")} />;
}
