// O SSR roda no Node portatil no Windows. Registrar SOMENTE categoria e
// componente no backend local, sem stack, URL, ID de contato ou mensagem.
import { classifyComponent, classifyUiError } from "./ui-diagnostics";

export async function reportServerCrash(error: unknown) {
  if (typeof process === "undefined" || process.platform !== "win32" ||
      typeof fetch !== "function") return;
  try {
    await fetch("http://127.0.0.1:3001/internal/client-diagnostic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:8080",
      },
      body: JSON.stringify({
        event: "UI_SERVER_ERROR",
        status: classifyUiError(error),
        component: classifyComponent(error instanceof Error ? error.stack : undefined),
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // O servidor de diagnóstico pode não estar pronto: nunca bloquear SSR.
  }
}
