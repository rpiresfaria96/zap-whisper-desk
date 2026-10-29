// Diagnostico local: apenas estados e contadores conhecidos.
// Nunca escreve QR Code, chaves, tokens, URLs de pareamento, mensagens ou contatos.
import { appendFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const LOG_FILE = join(dirname(dirname(fileURLToPath(import.meta.url))), "LOG_DIAGNOSTICO.txt");
const MAX_LOG_BYTES = 400_000;
const VALID_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;
const VALID_VALUE = /^[A-Za-z0-9_-]{0,45}$/;
let full = false;

export function diagnostic(component, event, details = {}) {
  if (!VALID_NAME.test(component) || !VALID_NAME.test(event) || full) return;
  const safe = {};
  for (const [key, value] of Object.entries(details)) {
    if (!VALID_NAME.test(key)) continue;
    if (typeof value === "boolean") safe[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "string" && VALID_VALUE.test(value)) safe[key] = value;
  }
  try {
    if (statSync(LOG_FILE, { throwIfNoEntry: false })?.size >= MAX_LOG_BYTES) {
      full = true;
      return;
    }
    appendFileSync(LOG_FILE, `${new Date().toISOString()} [${component}] ${event} ${JSON.stringify(safe)}\n`, { encoding: "utf8" });
  } catch {
    // Log e auxiliar e nunca deve impedir o WhatsApp de funcionar.
  }
}

export function errorKind(error) {
  const status = Number(error?.statusCode);
  if (status >= 100 && status <= 599) return `HTTP_${status}`;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "TIMEOUT";
  const code = error?.cause?.code || error?.code;
  if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EADDRINUSE"].includes(code)) return code;
  return "UNKNOWN_ERROR";
}
