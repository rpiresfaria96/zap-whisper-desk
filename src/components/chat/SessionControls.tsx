import { useState } from "react";
import { Power, QrCode, RefreshCw } from "lucide-react";

const configuredUrl = "/ideal-api";

export function SessionControls() {
  const [busy, setBusy] = useState<"close" | "relink" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const localApi = () => {
    if (configuredUrl) return configuredUrl;
    if (typeof window !== "undefined") return "/ideal-api";
    return null;
  };
  const send = async (path: string, body?: object) => {
    const base = localApi();
    if (!base) throw Error("A API local não está disponível.");
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw Error(data.error || "O servidor não concluiu a operação.");
  };

  async function closeSession() {
    if (busy || !window.confirm(
      "Encerrar a sessão do WPPConnect? O vínculo e os dados de autenticação serão preservados. Você poderá iniciar novamente sem ler o QR."
    )) return;
    setBusy("close"); setError(""); setNotice("");
    try {
      await send("/connection/close");
      setNotice("Sessão encerrada sem desvincular o WhatsApp. Use o botão Iniciar na tela de conexão para reconectar.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao encerrar."); }
    finally { setBusy(null); }
  }

  async function relink() {
    if (busy) return;
    if (!window.confirm(
      "ATENÇÃO: esta ação desvincula o WhatsApp do WPPConnect e apaga os dados locais de autenticação dessa sessão. Não apaga as mensagens no celular. Deseja continuar?"
    )) return;
    const typed = window.prompt("Para confirmar a nova leitura de QR, escreva exatamente DESVINCULAR:");
    if (typed !== "DESVINCULAR") {
      setNotice("Desvinculação cancelada. A sessão foi preservada.");
      return;
    }
    setBusy("relink"); setError(""); setNotice("");
    try {
      await send("/connection/relink", { confirmation: typed });
      setNotice("Vínculo antigo encerrado. Iniciando a geração de um novo QR...");
      await send("/connection/start");
      setNotice("Novo QR solicitado. Aguarde a tela de pareamento aparecer.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao desvincular."); }
    finally { setBusy(null); }
  }

  return (
    <section aria-label="Gerenciar sessão do WhatsApp" className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">Sessão do WhatsApp</h2>
      <p className="text-xs text-muted-foreground">
        Sem criar novas sessões. Use Encerrar para recuperar uma conexão travada
        mantendo o pareamento. Use Novo QR somente quando precisar realmente desvincular o aparelho.
      </p>
      <button type="button" disabled={busy !== null} onClick={() => void closeSession()}
        className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50">
        <Power className="h-4 w-4 shrink-0" />
        {busy === "close" ? "Encerrando..." : "Encerrar sessão (preserva vínculo)"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => void relink()}
        className="flex w-full items-center gap-2 rounded-lg border border-amber-600/30 px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50">
        {busy === "relink" ? <RefreshCw className="h-4 w-4 shrink-0 animate-spin" /> :
          <QrCode className="h-4 w-4 shrink-0" />}
        {busy === "relink" ? "Desvinculando..." : "Desvincular e ler novo QR"}
      </button>
      {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
