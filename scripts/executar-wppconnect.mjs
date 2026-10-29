// Inicia o WPPConnect pelo Corepack e captura apenas sinais tecnicos seguros.
// QR ASCII, URL de pareamento, token, chave e payloads sao omitidos do log.
// Nenhuma dependencia adicional: usa Node portatil ja presente.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { StringDecoder } from "node:string_decoder";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { diagnostic, errorKind, LOG_FILE } from "../backend/diagnostics.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WPP_DIR = join(ROOT, "wppconnect-server");
diagnostic("WPP", "PROCESS_START", { port: 8788, source: "COREPACK_YARN_DEV" });
console.log("[Ideal Zap] Registro de diagnostico:", LOG_FILE);
console.log("[Ideal Zap] QR, URLs de pareamento e credenciais nao sao gravados no log.");

const child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "corepack.cmd yarn dev"], {
  cwd: WPP_DIR,
  env: { ...process.env, PORT: "8788" },
  windowsHide: true,
  stdio: ["inherit", "pipe", "pipe"],
});

// Fallback independente do callback interno do WPPConnect:
// a biblioteca escreve a URI do QR no stdout, mesmo quando a API devolve CLOSED.
// Transformamos esse valor SOMENTE em memoria em PNG, sem registra-lo em disco.
// O destino e estritamente o adaptador local com chave aleatoria no .env.
const fromWpp = createRequire(join(WPP_DIR, "package.json"));
let lastQrHash = "";
function readBridgeConfig() {
  try {
    const config = readFileSync(join(ROOT, "backend", ".env"), "utf8");
    const key = config.match(/^WPP_QR_BRIDGE_SECRET=([a-f0-9]{64})\s*$/m)?.[1];
    const session = config.match(/^WPP_SESSION=([A-Za-z0-9_-]+)\s*$/m)?.[1];
    if (key && session) return { key, session };
  } catch {}
  return null;
}

async function forwardQrFromTerminal(line) {
  let pairingUri = null;
  try {
    const data = JSON.parse(line.trim());
    if (typeof data?.code === "string" &&
        /^https:\/\/wa\.me\/settings\/linked_devices#2@[A-Za-z0-9+,/=]{60,1500}$/.test(data.code)) {
      pairingUri = data.code;
    }
  } catch {}
  if (!pairingUri) {
    diagnostic("WPP", "QR_STDOUT_UNRECOGNIZED", {});
    return;
  }

  const digest = createHash("sha256").update(pairingUri).digest("hex");
  if (digest === lastQrHash) return;
  lastQrHash = digest;
  diagnostic("WPP", "QR_STDOUT_CAPTURED", { valid: true });

  const config = readBridgeConfig();
  if (!config) {
    diagnostic("WPP", "QR_STDOUT_CONFIG_MISSING", {});
    return;
  }
  try {
    const QRCode = fromWpp("qrcode");
    const image = await QRCode.toDataURL(pairingUri, { errorCorrectionLevel: "M", width: 500 });
    // A chave fica na URL da solicitacao local, mas nunca no terminal/log.
    const response = await fetch(`http://127.0.0.1:3001/internal/wpp-hook?key=${config.key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "qrcode", session: config.session, qrcode: image }),
      signal: AbortSignal.timeout(8000),
    });
    diagnostic("WPP", "QR_STDOUT_DELIVERY", { httpStatus: response.status });
  } catch (error) {
    diagnostic("WPP", "QR_STDOUT_DELIVERY_FAILED", { kind: errorKind(error) });
  }
}

let qrCount = 0;
let lastEvent = "";
function traceWpp(line) {
  const plain = line.replace(/\x1b\[[0-9;]*m/g, "");
  // NUNCA imprimir nem gravar a URI; usar somente para preparar a imagem local.
  if (/^\s*\{\s*"code"\s*:/.test(plain)) {
    void forwardQrFromTerminal(plain);
    console.log("[Ideal Zap] Dados do QR protegidos; imagem enviada ao adaptador local.");
    return;
  }
  let event = "";
  let details = {};
  if (/\[IdealZapQrBridge\] AUTH_EVENT_([A-Za-z]+)/.test(plain)) {
    event = "AUTH_EVENT";
    details = { status: RegExp.$1 };
  } else if (/\[IdealZapQrBridge\] AUTH_CALLBACK_STALE/.test(plain)) event = "AUTH_CALLBACK_STALE";
  else if (/\[IdealZapQrBridge\] QR_CALLBACK_RECEIVED/.test(plain)) event = "QR_CALLBACK_RECEIVED";
  else if (/\[IdealZapQrBridge\] QR_CALLBACK_STALE_([A-Z]+)/.test(plain)) {
    event = "QR_CALLBACK_STALE";
    details = { reason: RegExp.$1 };
  } else if (/\[IdealZapQrBridge\] QR_CALLBACK_STALE/.test(plain)) event = "QR_CALLBACK_STALE";
  else if (/\[IdealZapQrBridge\] QR_HOOK_MISSING/.test(plain)) event = "QR_HOOK_MISSING";
  else if (/\[IdealZapQrBridge\] QR_SEND_NETWORK_ERROR/.test(plain)) event = "QR_SEND_NETWORK_ERROR";
  else if (/\[IdealZapQrBridge\] QR_SEND_HTTP_(\d+)/.test(plain)) {
    event = "QR_SEND_RESULT";
    details = { httpStatus: Number(RegExp.$1) };
  }
  else if (/\[IdealZapForward\] V2_FAILED/.test(plain)) event = "FORWARD_V2_FAILED";
  else if (/\[IdealZapForward\] LEGACY_OK/.test(plain)) event = "FORWARD_LEGACY_OK";
  else if (/\[IdealZapForward\] NATIVE_NOT_SENT/.test(plain)) event = "FORWARD_NATIVE_NOT_SENT";
  else if (/\[IdealZapRevoke\] NOT_REVOKED/.test(plain)) event = "REVOKE_NATIVE_NOT_CONFIRMED";
  else if (/Server is running on port:\s*8788/i.test(plain)) event = "LISTENING";
  else if (/WPPConnect-Server version:\s*2\.10\.61/i.test(plain)) event = "VERSION_2_10_61";
  else if (/Session Unpaired/i.test(plain)) event = "SESSION_UNPAIRED";
  else if (/Initializing browser/i.test(plain)) event = "BROWSER_INITIALIZING";
  else if (/WhatsApp WEB loaded/i.test(plain)) event = "WHATSAPP_PAGE_LOADED";
  else if (/Waiting for QRCode Scan \(Attempt\s*(\d+)/i.test(plain)) {
    event = "QR_GENERATED_IN_WPP";
    details = { attempt: Number(RegExp.$1), count: ++qrCount };
  } else if (/Waiting for QRCode Scan/i.test(plain)) event = "WAITING_QR";
  else if (/Current state:\s*QR\b/i.test(plain)) event = "STATE_QR";
  else if (/Auto close configured/i.test(plain)) event = "AUTOCLOSE_CONFIGURED";
  else if (/Auto Close Called/i.test(plain)) event = "AUTOCLOSE_TRIGGERED";
  else if (/Failed to authenticate/i.test(plain)) event = "AUTH_NOT_COMPLETED";
  else if (/browser is already running/i.test(plain)) event = "DUPLICATE_BROWSER";
  else if (/Error no open browser/i.test(plain)) event = "BROWSER_OPEN_FAILED";
  else if (/Version not available/i.test(plain)) event = "WHATSAPP_VERSION_FALLBACK";
  else if (/Started Session:/i.test(plain)) event = "SESSION_CONNECTED";
  else if (/Webhook.*(allowlist|refus|denied)/i.test(plain)) event = "WEBHOOK_REJECTED";
  else if (/Error calling Webhook/i.test(plain)) event = "WEBHOOK_SEND_FAILED";
  else if (/Error:|error:/i.test(plain)) event = "OTHER_ERROR";
  // Resumir repeticoes como Current state QR; nao registrar dados de terceiros.
  if (event && (event !== lastEvent || event === "QR_GENERATED_IN_WPP")) {
    diagnostic("WPP", event, details);
  }
  if (event) lastEvent = event;

  // O cmd continua legivel, mas nunca imprime o codigo de pareamento.
  if (/wa\.me\/settings\/linked_devices|["']code["']\s*:/i.test(plain)) {
    console.log("[Ideal Zap] Payload de vinculacao oculto por seguranca.");
    return;
  }
  if (/[█▀▄]/.test(plain)) return;
  if (/key=[A-Za-z0-9]|WEBHOOK_ALLOWED_URLS|Authorization:\s*Bearer|SECRET_KEY|WPP_TOKEN|WPP_QR_BRIDGE_SECRET/i.test(plain)) return;
  if (plain.length < 1500) console.log(plain);
}

function receive(stream) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += decoder.write(chunk);
    const lines = buffer.split(/\r?\n|\r/);
    buffer = lines.pop() || "";
    for (const line of lines) traceWpp(line);
    if (buffer.length > 5000) buffer = "";
  });
  stream.on("end", () => {
    buffer += decoder.end();
    if (buffer) traceWpp(buffer);
  });
}
receive(child.stdout);
receive(child.stderr);

child.on("error", (error) => {
  diagnostic("WPP", "PROCESS_SPAWN_ERROR", { kind: errorKind(error) });
  console.error("[Ideal Zap] Falha ao abrir WPPConnect. Confira Node/Corepack.");
});
child.on("close", (code) => {
  diagnostic("WPP", "PROCESS_EXIT", { exitCode: typeof code === "number" ? code : -1 });
  process.exitCode = Number.isInteger(code) ? code : 1;
});
