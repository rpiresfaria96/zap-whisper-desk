import { Mic, Paperclip, SendHorizontal, Smile, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";

const quickEmojis = ["😀", "😂", "😍", "🙏", "👍", "🎉", "❤️", "🔥", "😅", "🙌", "😎", "🤝"];

export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!recording) return setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  const send = () => {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText("");
    setEmojiOpen(false);
  };

  return (
    <footer className="relative shrink-0 bg-panel-header px-3 py-2.5">
      {emojiOpen && (
        <div className="absolute bottom-full left-3 mb-2 grid grid-cols-6 gap-1 rounded-xl border bg-popover p-2 shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {quickEmojis.map((e) => (
            <button key={e} className="h-9 w-9 rounded-lg text-xl transition hover:bg-selected" onClick={() => { setText((t) => t + e); ta.current?.focus(); }}>
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1">
        <IconButton aria-label="Emojis" active={emojiOpen} onClick={() => setEmojiOpen((o) => !o)}><Smile /></IconButton>
        <IconButton aria-label="Anexar"><Paperclip /></IconButton>
        <div className="flex min-h-10 flex-1 items-center rounded-xl bg-card px-4 py-2">
          {recording ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
              Gravando… {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
            </div>
          ) : (
            <textarea
              ref={ta}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Digite uma mensagem"
              className="scroll-thin max-h-36 w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
            />
          )}
        </div>
        {text.trim() ? (
          <button aria-label="Enviar" onClick={send} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95 animate-in zoom-in-75">
            <SendHorizontal className="h-5 w-5" />
          </button>
        ) : (
          <IconButton
            aria-label={recording ? "Parar gravação" : "Gravar áudio"}
            onClick={() => setRecording((r) => !r)}
            className={cn(recording && "bg-destructive text-destructive-foreground hover:bg-destructive hover:text-destructive-foreground")}
          >
            {recording ? <Square /> : <Mic />}
          </IconButton>
        )}
      </div>
    </footer>
  );
}
