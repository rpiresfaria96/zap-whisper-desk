// Relato local de erros de interface sem dados do WhatsApp.
// Somente codigos conhecidos; nunca transmitir mensagem, pilha, nome ou contato.
const categories = [
  ["REACT_CHILD_OBJECT", /objects are not valid as a react child/i],
  ["REACT_HOOK", /invalid hook|rendered more hooks|rendered fewer hooks/i],
  ["REACT_RECURSION", /maximum update depth|too many re-renders/i],
  ["MISSING_VALUE", /cannot read propert|undefined is not an object|not a function/i],
  ["HYDRATION", /hydration|hydrating/i],
  ["DOM_ERROR", /scrollIntoView|removeChild|insertBefore/i],
  ["INVALID_DATE", /invalid time value|invalid date/i],
] as const;

export function classifyUiError(error: unknown): string {
  const input = error instanceof Error ? error.message : "";
  for (const [code, pattern] of categories) if (pattern.test(input)) return code;
  return "OTHER_RENDER_ERROR";
}

const components = [
  "MessageList", "MessageBubble", "MediaView", "ChatHeader", "ChatList",
  "ContactAvatar", "Composer", "WhatsAppConnection", "Index", "RootComponent",
] as const;

export function classifyComponent(stack: string | undefined): string {
  if (typeof stack !== "string") return "Unknown";
  let first: string = "Unknown";
  let bestIndex = Number.POSITIVE_INFINITY;
  for (const item of components) {
    const position = stack.indexOf(item);
    if (position >= 0 && position < bestIndex) {
      first = item;
      bestIndex = position;
    }
  }
  return first;
}

export function reportUiCrash(source: "UI_RENDER_ERROR" | "UI_ROOT_ERROR",
  error: unknown, componentStack?: string) {
  if (typeof window === "undefined" || typeof fetch !== "function" ||
      !["127.0.0.1", "localhost"].includes(window.location.hostname)) return;
  const api = "/ideal-api";
  void fetch(`${api}/internal/client-diagnostic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: source, status: classifyUiError(error),
      component: classifyComponent(componentStack),
    }),
  }).catch(() => {});
}
