import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/chat/format";
import { chatService } from "@/lib/chat/service";
import type { Contact } from "@/lib/chat/types";

const hues = [152, 200, 30, 280, 340, 60, 240, 100];
const memory = new Map<string, { url: string | null; at: number }>();
const TTL = 10 * 60_000;

function trustedAvatarFallback(value: string | undefined): string | null {
  if (!value || value.length > 4000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    return ["whatsapp.net", "whatsapp.com", "fbcdn.net"].some(
      (domain) => host === domain || host.endsWith("." + domain)
    ) ? url.href : null;
  } catch { return null; }
}

export function ContactAvatar({ contact, size = 48, className }: {
  contact: Contact; size?: number; className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const cached = memory.get(contact.id);
  const [source, setSource] = useState<string | null>(
    cached && Date.now() - cached.at < TTL ? cached.url : null
  );
  const [failed, setFailed] = useState(false);
  const index = Number.parseInt(contact.id.slice(0, 5), 36);
  const hue = hues[(Number.isFinite(index) ? index : 0) % hues.length];

  useEffect(() => {
    let active = true;
    setFailed(false);
    const saved = memory.get(contact.id);
    if (saved && Date.now() - saved.at < TTL) {
      setSource(saved.url);
      return;
    }
    setSource(null);

    let observer: IntersectionObserver | null = null;
    const resolve = async () => {
      observer?.disconnect();
      try {
        const remote = await chatService.getAvatar(contact.id);
        const url = remote || trustedAvatarFallback(contact.avatarUrl);
        memory.set(contact.id, { url, at: Date.now() });
        if (active) setSource(url);
      } catch {
        const backup = trustedAvatarFallback(contact.avatarUrl);
        memory.set(contact.id, { url: backup, at: Date.now() });
        if (active) setSource(backup);
      }
    };
    if (typeof IntersectionObserver === "function" && container.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void resolve();
      }, { rootMargin: "160px" });
      observer.observe(container.current);
    } else if (typeof window !== "undefined") {
      void resolve();
    }
    return () => { active = false; observer?.disconnect(); };
  }, [contact.id, contact.avatarUrl]);

  return (
    <div ref={container} className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}>
      {source && !failed ? (
        <img src={source} alt={contact.name} loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full font-semibold"
          style={{
            background: `oklch(0.88 0.06 ${hue})`,
            color: `oklch(0.38 0.1 ${hue})`,
            fontSize: size * 0.36,
          }}>
          {initials(contact.name || "?")}
        </div>
      )}
      {contact.online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-primary" />
      )}
    </div>
  );
}
