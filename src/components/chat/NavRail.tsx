import { MessageCircle, Users, Star, Settings, Moon, Sun } from "lucide-react";
import { IconButton } from "./IconButton";

export type NavSection = "chats" | "contacts" | "favorites" | "settings";

const items: { id: NavSection; label: string; icon: typeof MessageCircle }[] = [
  { id: "chats", label: "Conversas", icon: MessageCircle },
  { id: "contacts", label: "Contatos", icon: Users },
  { id: "favorites", label: "Favoritos", icon: Star },
];

interface Props {
  active: NavSection;
  onChange: (s: NavSection) => void;
  dark: boolean;
  onToggleTheme: () => void;
  unread: number;
}

export function NavRail({ active, onChange, dark, onToggleTheme, unread }: Props) {
  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r bg-rail py-3">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <MessageCircle className="h-5 w-5" fill="currentColor" />
      </div>
      {items.map(({ id, label, icon: Icon }) => (
        <div key={id} className="relative">
          <IconButton title={label} aria-label={label} active={active === id} onClick={() => onChange(id)}>
            <Icon />
          </IconButton>
          {id === "chats" && unread > 0 && (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </div>
      ))}
      <div className="mt-auto flex flex-col items-center gap-1">
        <IconButton title="Alternar tema" aria-label="Alternar tema" onClick={onToggleTheme}>
          {dark ? <Sun /> : <Moon />}
        </IconButton>
        <IconButton title="Configurações" aria-label="Configurações" active={active === "settings"} onClick={() => onChange("settings")}>
          <Settings />
        </IconButton>
      </div>
    </nav>
  );
}
