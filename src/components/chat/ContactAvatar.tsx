import { cn } from "@/lib/utils";
import { initials } from "@/lib/chat/format";
import type { Contact } from "@/lib/chat/types";

const hues = [152, 200, 30, 280, 340, 60, 240, 100];

export function ContactAvatar({ contact, size = 48, className }: { contact: Contact; size?: number; className?: string }) {
  const hue = hues[Number.parseInt(contact.id, 36) % hues.length];
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      {contact.avatarUrl ? (
        <img src={contact.avatarUrl} alt={contact.name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-semibold"
          style={{
            background: `oklch(0.88 0.06 ${hue})`,
            color: `oklch(0.38 0.1 ${hue})`,
            fontSize: size * 0.36,
          }}
        >
          {initials(contact.name)}
        </div>
      )}
      {contact.online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-primary" />
      )}
    </div>
  );
}
