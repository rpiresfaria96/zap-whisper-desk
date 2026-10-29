import { QrCode, RefreshCw, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SessionControls } from "./SessionControls";

type Connection = {
  status: string;
  qrCode: string | null;
  message: string | null;
  manualClose?: boolean;
};

const configuredApi = "/ideal-api";

function statusText(status: string) {
  switch (status) {
    case "LOADING": return "Verificando o servidor...";
    case "INITIALIZING": return "Preparando o WhatsApp e gerando QR Code...";
    case "QRCODE": return "Aguardando leitura do QR Code...";
    case "CLOSED": return "Aguardando início da sessão.";
    case "OFFLINE": return "O WPPConnect não está respondendo. Feche as janelas antigas e execute INICIAR.bat novamente.";
    case "NOT_CONFIGURED": return "A sessão ainda não foi configurada.";
    case "ERROR": return "Falha ao iniciar a sessão.";
    default: return `Estado do WhatsApp: ${status}`;
  }
}

export function WhatsAppConnection({ onConnected }: { onConnected?: () => void }) {
  const [apiUrl, setApiUrl] = useState<string | undefined>(configuredApi);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const [heartbeat, setHeartbeat] = useState(0);
  const wasConnected = useRef(false);
  const lastAutoStartAt = useRef(0);
  const refreshPending = useRef(false);
  const startPending = useRef(false);
  const lastStatusReported = useRef("");

  // Apenas eventos tecnicos. Nao enviamos QR, contatos ou mensagens.
  const reportDiagnostic = useCallback((event: string, status: string, qrPresent = false, httpStatus = 0) => {
    if (!apiUrl) return;
    void fetch(`${apiUrl}/internal/client-diagnostic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, status, qrPresent, httpStatus }),
    }).catch(() => {});
  }, [apiUrl]);

  // Sem .env, usar a API local apenas quando a interface roda localmente.
  // A deteccao no useEffect evita diferencas de hidratacao no SSR.
  useEffect(() => {
    setApiUrl("/ideal-api");
  }, []);

  const refresh = useCallback(async () => {
    if (!apiUrl || refreshPending.current) return;
    refreshPending.current = true;
    try {
      const response = await fetch(`${apiUrl}/connection`, { cache: "no-store" });
      if (!response.ok) throw new Error(`API HTTP ${response.status}`);
      const next = (await response.json()) as Connection;
      setConnection(next);
      setError("");
      const signature = `${next.status}:${Boolean(next.qrCode)}`;
      if (signature !== lastStatusReported.current) {
        lastStatusReported.current = signature;
        reportDiagnostic("POLL_OK", next.status, Boolean(next.qrCode));
      }
      const connected = next.status === "CONNECTED";
      if (connected && !wasConnected.current) onConnected?.();
      wasConnected.current = connected;
    } catch {
      if (lastStatusReported.current !== "OFFLINE:false") {
        lastStatusReported.current = "OFFLINE:false";
        reportDiagnostic("POLL_FAILED", "OFFLINE");
      }
      wasConnected.current = false;
      setConnection({ status: "OFFLINE", qrCode: null, message: null });
      setError("Não foi possível consultar a API local. Verifique a janela Ideal Zap - API 3001.");
    } finally {
      refreshPending.current = false;
    }
  }, [onConnected, reportDiagnostic]);

  const startSession = useCallback(async () => {
    if (!apiUrl || startPending.current) return;
    startPending.current = true;
    setStarting(true);
    reportDiagnostic("START_CLICKED", connection?.status || "UNKNOWN");
    try {
      const response = await fetch(`${apiUrl}/connection/start`, { method: "POST" });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || `Falha ao iniciar (HTTP ${response.status})`);
      setActionMessage(result.message || "Iniciando a sessão...");
      setError("");
      reportDiagnostic("START_OK", connection?.status || "UNKNOWN", false, response.status);
      await refresh();
    } catch (cause) {
      reportDiagnostic("START_FAILED", connection?.status || "UNKNOWN");
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a sessão.");
    } finally {
      startPending.current = false;
      setStarting(false);
    }
  }, [apiUrl, connection?.status, refresh, reportDiagnostic]);

  useEffect(() => {
    if (!apiUrl) return;
    reportDiagnostic("UI_READY", "LOADING");
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
      setHeartbeat((n) => (n + 1) % 100000);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refresh, reportDiagnostic]);

  // Recria a sessao automaticamente quando o QR expirar, MAS apenas apos
  // o tempo de fechamento do navegador WPPConnect (120 s) + margem.
  // Evita o erro "browser already running" e permite novas tentativas
  // sem executar INICIAR.bat novamente.
  useEffect(() => {
    if (connection?.status === "CLOSED" && !connection.manualClose && !connection.qrCode &&
        !startPending.current && Date.now() - lastAutoStartAt.current > 140_000) {
      lastAutoStartAt.current = Date.now();
      void startSession();
    }
  }, [connection?.status, connection?.qrCode, heartbeat, startSession]);

  if (!apiUrl) return (
    <div role="status" className="border-b bg-amber-500/10 p-3 text-sm">
      Modo demonstração. Execute PREPARAR_AMBIENTE.bat e INICIAR.bat no Windows.
    </div>
  );

  const status = connection?.status || "LOADING";
  if (status === "CONNECTED") return (
    <div role="status" className="border-b bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-700 dark:text-emerald-300">
      WhatsApp conectado
    </div>
  );

  const showStart = ["CLOSED", "ERROR", "UNKNOWN"].includes(status);
  const qrCode = connection?.qrCode;
  const detail = error || (connection?.manualClose ? "Sessão encerrada por você. Clique em Iniciar para reconectar com o vínculo salvo." : null) || connection?.message || actionMessage || statusText(status);

  return (
    <>
      <div role="status" className="border-b bg-amber-500/10 px-3 py-2 text-center text-sm">
        WhatsApp aguardando conexão
      </div>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Conectar WhatsApp ao Ideal Zap"
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/95 px-3 py-6 backdrop-blur-sm"
      >
        <div className="w-full max-w-lg rounded-2xl border bg-card p-5 text-center shadow-2xl sm:p-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Smartphone className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold sm:text-2xl">Conectar WhatsApp</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escaneie o QR Code e confirme a vinculação no celular. Se expirar,
            o Ideal Zap tentará gerar outro automaticamente.
          </p>

          <div className="mx-auto my-5 flex min-h-[260px] w-full max-w-[320px] items-center justify-center rounded-xl bg-white p-3">
            {qrCode ? (
              <img
                src={qrCode}
                onLoad={() => reportDiagnostic("QR_IMAGE_LOADED", status, true)}
                onError={() => reportDiagnostic("QR_IMAGE_FAILED", status, true)}
                alt="QR Code de vinculação do WhatsApp"
                width={296}
                height={296}
                className="h-auto w-full"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 px-5 py-8 text-slate-500">
                <QrCode className="h-16 w-16 animate-pulse" />
                <p className="text-sm">
                  {status === "INITIALIZING" || status === "QRCODE"
                    ? "Aguardando o QR Code do WhatsApp..."
                    : "QR Code ainda não disponível."}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1 text-left text-sm">
            <p><strong>1.</strong> Abra o WhatsApp no seu celular.</p>
            <p><strong>2.</strong> Toque em <strong>Dispositivos conectados</strong>.</p>
            <p><strong>3.</strong> Escolha <strong>Conectar dispositivo</strong> e leia o código.</p>
          </div>
          <p aria-live="polite" className="mt-4 text-sm text-muted-foreground">{detail}</p>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          {status === "OFFLINE" && (
            <p className="mt-2 text-xs text-muted-foreground">
              O serviço WPPConnect parece ter parado. Feche as janelas antigas
              e execute apenas INICIAR.bat para recuperá-lo.
            </p>
          )}
          {status === "ERROR" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Se houver aviso de navegador já aberto, feche as janelas antigas do Ideal Zap e inicie novamente.
              Não apague a pasta da sessão.
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {showStart && (
              <button
                type="button"
                onClick={() => void startSession()}
                disabled={starting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {starting ? "Preparando..." : qrCode ? "Gerar novo QR" : "Iniciar / tentar novamente"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar QR
            </button>
          </div>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Recuperar sessão travada / ler novo QR
            </summary>
            <div className="mt-3"><SessionControls /></div>
          </details>

        </div>
      </section>
    </>
  );
}
