import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { diagnostic, errorKind, LOG_FILE } from "./diagnostics.mjs";
import { normalizeMediaPayload } from "./media-utils.mjs";
import { phoneFromPnLidEntry, collapseMappedContacts } from "./contact-identity.mjs";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv(join(here, ".env"));

const PORT = Number(process.env.API_PORT || 3001);
const WPP_BASE_URL = (process.env.WPP_BASE_URL || "http://127.0.0.1:8788").replace(/\/+$/, "");
const WPP_SESSION = process.env.WPP_SESSION || "";
const WPP_TOKEN = process.env.WPP_TOKEN || "";
const QR_BRIDGE_SECRET = process.env.WPP_QR_BRIDGE_SECRET || "";
const QR_BRIDGE_URL = QR_BRIDGE_SECRET && /^[a-f0-9]{64}$/.test(QR_BRIDGE_SECRET)
  ? `http://127.0.0.1:${PORT}/internal/wpp-hook?key=${QR_BRIDGE_SECRET}` : null;
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000")
  .split(",").map((s) => s.trim()).filter(Boolean);

diagnostic("API", "PROCESS_START", { port: PORT, tokenConfigured: Boolean(WPP_TOKEN), sessionConfigured: Boolean(WPP_SESSION), qrBridgeConfigured: Boolean(QR_BRIDGE_URL) });

function loadEnv(path) {
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env is optional; /health explains which settings are missing.
  }
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function requireConfig() {
  if (!WPP_SESSION || !WPP_TOKEN) {
    const err = new Error("Configure WPP_SESSION e WPP_TOKEN no arquivo backend/.env.");
    err.statusCode = 503;
    throw err;
  }
}

function authHeader() {
  const token = WPP_TOKEN.trim();
  return /^Bearer\s/i.test(token) ? token : `Bearer ${token}`;
}

async function callWpp(path, options = {}) {
  requireConfig();
  const response = await fetch(`${WPP_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: authHeader(),
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  const text = await response.text();
  let payload = text;
  try { payload = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok || (payload && typeof payload === "object" &&
      (payload.status === "error" || payload.status === false || payload.success === false))) {
    const err = new Error(`WPPConnect respondeu erro na operação (HTTP ${response.status}). Verifique a sessão e o token.`);
    err.statusCode = response.ok ? 502 :
      (response.status === 401 || response.status === 403 ? 502 : response.status);
    err.details = typeof payload === "string" ? payload.slice(0, 300) : undefined;
    const safeReasons = new Set(["not_author", "not_accepted", "missing_remote",
      "message_not_found", "not_confirmed", "evaluation_failed", "unknown"]);
    err.safeReason = safeReasons.has(payload?.reason) ? payload.reason : "unknown";
    throw err;
  }
  return payload;
}

function sessionPath(endpoint) {
  return `/api/${encodeURIComponent(WPP_SESSION)}/${endpoint}`;
}

function asId(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  if (typeof value._serialized === "string") return value._serialized;
  if (typeof value.serialized === "string") return value.serialized;
  if (typeof value.remote === "string") return value.remote;
  if (value.user != null && value.server != null) return `${value.user}@${value.server}`;
  if (typeof value.id === "string") return value.id;
  return "";
}

function sourceArray(payload) {
  let value = payload;
  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    let next;
    for (const key of ["response", "data", "messages", "chats", "items", "result"]) {
      if (value[key] !== undefined) { next = value[key]; break; }
    }
    if (next === undefined || next === value) return [];
    value = next;
  }
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function epochMs(value) {
  if (typeof value === "string" && !/^\d+(\.\d+)?$/.test(value)) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return Date.now();
  return number < 1_000_000_000_000 ? number * 1000 : number;
}

// Chat rows may carry their latest activity in `t`, without `lastMessage`.
// Unlike epochMs (used for messages), missing chat activity is never "now".
function knownActivityMs(value) {
  const parsed = typeof value === "string" && !/^\d+(\.\d+)?$/.test(value)
    ? Date.parse(value) : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 1_000_000_000) return 0;
  const ms = parsed < 1_000_000_000_000 ? parsed * 1000 : parsed;
  return ms <= Date.now() + 86_400_000 ? ms : 0;
}

function mediaKind(raw) {
  const type = String(raw?.type || "").toLowerCase();
  const mime = String(raw?.mimetype || raw?.mimeType || "").toLowerCase();
  if (type === "gif") return "image";
  if (["image", "sticker", "audio", "ptt", "video", "document"].includes(type)) return type;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return raw?.isPtt ? "ptt" : "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("application/") || mime.startsWith("text/")) return "document";
  return undefined;
}
function safeMessageText(input) {
  if (typeof input !== "string") return "";
  const t = input.trim();
  if (t.length > 8000 || /^data:[^\s]{0,150};base64,/i.test(t) ||
      /^[A-Za-z0-9+/=]{200,}$/.test(t) ||
      /[\u0000-\u0008\u000e-\u001f]/.test(t)) return "";
  return t;
}
// Cartões recebidos podem vir no campo body (WPP 2.3.x), vcard ou
// message.contactMessage. Guardar apenas nome/telefone normalizados.
function normalizeSharedContact(raw) {
  const type = String(raw?.type || raw?.message?.type || "").toLowerCase();
  const fields = [raw?.vcard, raw?.body, raw?.contact?.vcard,
    raw?.message?.contactMessage?.vcard, raw?.message?.contactsArrayMessage?.contacts?.[0]?.vcard];
  const vcard = fields.find((value) => typeof value === "string" &&
    /BEGIN:VCARD/i.test(value) && value.length < 100_000) || "";
  const cardMessage = raw?.message?.contactMessage || {};
  const fallback = raw?.contacts?.[0] || raw?.vcardList?.[0] || {};
  if (!["vcard", "multi_vcard", "contact"].includes(type) && !vcard) return null;
  const decoded = vcard.replace(/\\n/g, "\n");
  const phoneMatch = decoded.match(/(?:^|\n)TEL[^:\r\n]{0,180}:([^\r\n]+)/i);
  const waidMatch = decoded.match(/(?:^|\n)TEL[^\r\n]{0,180}waid=([0-9]{7,15})/i);
  const candidates = [waidMatch?.[1], phoneMatch?.[1], cardMessage?.phoneNumber,
    raw?.phoneNumber, raw?.contact?.phone, fallback?.phoneNumber, fallback?.phone];
  let digits = "";
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const valueDigits = value.replace(/\D/g, "");
    if (/^[0-9]{7,15}$/.test(valueDigits)) { digits = valueDigits; break; }
  }
  const fromVcard = decoded.match(/(?:^|\n)FN:([^\r\n]+)/i)?.[1];
  const rawName = raw?.contactName || cardMessage?.displayName ||
    raw?.message?.contactsArrayMessage?.displayName || raw?.name ||
    fallback?.displayName || fromVcard || "Contato";
  return { name: safeMessageText(rawName).slice(0, 100) || "Contato",
    phone: digits ? `+${digits}` : "" };
}

function bodyText(raw) {
  const kind = mediaKind(raw);
  const shared = normalizeSharedContact(raw);
  if (shared) return `[Contato] ${shared.name}`;
  if (kind) {
    const caption = [raw?.caption, raw?.message?.imageMessage?.caption,
      raw?.message?.videoMessage?.caption, raw?.message?.documentMessage?.caption]
      .map(safeMessageText).find(Boolean);
    const labels = { image: "[Imagem]", sticker: "[Figurinha]",
      audio: "[Áudio]", ptt: "[Áudio]", video: "[Vídeo]", document: "[Documento]" };
    return caption || labels[kind] || "[Mídia]";
  }
  return safeMessageText(raw?.body ?? raw?.text ?? raw?.content ??
    raw?.message?.conversation ?? raw?.message?.extendedTextMessage?.text);
}

function normalizeMessage(raw, chatId) {
  const id = asId(raw?.id) || asId(raw?.messageId) || asId(raw?.key?.id) || `msg-${chatId}-${epochMs(raw?.timestamp ?? raw?.t)}`;
  const timestamp = epochMs(raw?.timestamp ?? raw?.t ?? raw?.time ?? raw?.createdAt);
  const ack = Number(raw?.ack ?? raw?.ackStatus);
  const revoked = raw?.type === "revoked" || raw?.isRevoked === true;
  let status = raw?.status;
  if (!["sending", "sent", "delivered", "read"].includes(status)) {
    status = ack >= 3 ? "read" : ack >= 2 ? "delivered" : "sent";
  }
  return {
    id,
    chatId,
    fromMe: Boolean(raw?.fromMe ?? raw?.id?.fromMe ?? raw?.key?.fromMe),
    ...(chatId.endsWith("@g.us") ? {
      senderName: safeMessageText(raw?.sender?.pushname || raw?.senderObj?.pushname ||
        raw?.sender?.name || raw?.senderObj?.name || raw?.notifyName || "").slice(0, 65),
    } : {}),
    body: revoked ? "Mensagem apagada para todos" : bodyText(raw),
    ...(revoked ? { deleted: true } : {}),
    timestamp,
    status: Boolean(raw?.fromMe ?? raw?.id?.fromMe ?? raw?.key?.fromMe) ? status : undefined,
    ...(mediaKind(raw) ? { mediaType: mediaKind(raw) } : {}),
    ...(raw?.isGif === true || raw?.gifPlayback === true ||
      raw?.message?.videoMessage?.gifPlayback === true ||
      String(raw?.mimetype || raw?.mimeType || "").toLowerCase() === "image/gif" ||
      String(raw?.type || "").toLowerCase() === "gif"
      ? { isGif: true } : {}),
    ...(typeof (raw?.filename || raw?.fileName) === "string" &&
      (raw.filename || raw.fileName).length <= 140
      ? { filename: raw.filename || raw.fileName } : {}),
    ...(typeof (raw?.mimetype || raw?.mimeType) === "string" &&
      (raw.mimetype || raw.mimeType).length < 100
      ? { mimetype: raw.mimetype || raw.mimeType } : {}),
    ...(Number.isFinite(Number(raw?.size || raw?.fileSize)) &&
      Number(raw?.size || raw?.fileSize) > 0
      ? { fileSize: Number(raw?.size || raw?.fileSize) } : {}),
    ...(asId(raw?.quotedMsgId || raw?.quotedMsgObj?.id || raw?.quotedMsg?.id || raw?.quotedMessageId ||
        raw?.contextInfo?.stanzaId || raw?.message?.extendedTextMessage?.contextInfo?.stanzaId)
      ? { quotedId: asId(raw?.quotedMsgId || raw?.quotedMsgObj?.id || raw?.quotedMsg?.id ||
          raw?.quotedMessageId || raw?.contextInfo?.stanzaId || raw?.message?.extendedTextMessage?.contextInfo?.stanzaId),
          quotedText: safeMessageText(raw?.quotedMsgObj?.body || raw?.quotedMsg?.body ||
            raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation).slice(0, 200) } : {}),
    ...(Array.isArray(raw?.reactions) ? { reactions: raw.reactions
      .map((r) => safeMessageText(typeof r === "string" ? r : r?.text || r?.emoji))
      .filter(Boolean).slice(0, 10) } : {}),
    ...(normalizeSharedContact(raw) ? { contactCard: normalizeSharedContact(raw) } : {}),
    ...(raw?.starred === true || raw?.isStarred === true ? { starred: true } : {}),
    ...(raw?.isEdited === true || raw?.edited === true ||
      raw?.edit === true || raw?.message?.edited === true ||
      Number(raw?.editCount) > 0 ? { edited: true } : {}),
  };
}

function displayPhone(chatId, isGroup) {
  if (isGroup) return "Grupo";
  if (chatId.endsWith("@lid") || chatId.endsWith("@newsletter")) return "";
  const digits = chatId.split("@")[0].replace(/\D/g, "");
  return chatId.endsWith("@c.us") && digits ? `+${digits}` : "";
}

function normalizeChat(raw) {
  const id = asId(raw?.chatId) || asId(raw?.id) || asId(raw?.contact?.id) || asId(raw?.lastMessage?.chatId) || asId(raw?.conversationId);
  if (!id) return null;
  const isGroup = Boolean(raw?.isGroup) || id.endsWith("@g.us");
  const contact = raw?.contact || {};
  const phone = displayPhone(id, isGroup);
  const name = asText(raw?.name) || asText(raw?.formattedTitle) || asText(raw?.pushname) ||
    asText(contact?.name) || asText(contact?.pushname) || asText(contact?.formattedName) ||
    (isGroup ? "Grupo do WhatsApp" : phone || "Contato do WhatsApp");
  const history = Array.isArray(raw?.msgs) ? raw.msgs : Array.isArray(raw?.messages) ? raw.messages : [];
  const last = raw?.lastMessage || raw?.lastMessageObj || raw?.lastMsg ||
    raw?.last_message || raw?.last_message_obj || history[history.length - 1] ||
    (typeof raw?.lastMessageText === "string" ? { body: raw.lastMessageText, timestamp: raw?.timestamp ?? raw?.t } : null);
  const avatarUrl = asText(raw?.profilePicUrl) || asText(raw?.profilePicThumbObj?.eurl) ||
    asText(contact?.profilePicThumbObj?.eurl) || asText(contact?.profilePicUrl) || undefined;
  const unread = Number(raw?.unreadCount ?? raw?.unreadMessages ?? raw?.unreadMessageCount ?? 0);
  return {
    id,
    contact: { id, name, phone, ...(avatarUrl ? { avatarUrl } : {}), ...(isGroup ? { about: "Grupo" } : {}) },
    lastMessage: last && typeof last === "object" ? normalizeMessage(last, id) : undefined,
    activityAt: Math.max(knownActivityMs(raw?.t), knownActivityMs(raw?.timestamp),
      knownActivityMs(raw?.lastMessageTime), knownActivityMs(raw?.lastMsgTimestamp),
      knownActivityMs(raw?.lastMessage?.timestamp), knownActivityMs(last?.t),
      knownActivityMs(last?.timestamp)),
    archived: Boolean(raw?.archive ?? raw?.archived),
    unreadCount: Number.isFinite(unread) ? Math.max(0, unread) : 0,
    pinned: Boolean(raw?.pinned ?? raw?.pin),
    favorite: Boolean(raw?.favorite),
  };
}

function normalizeMessageList(payload, chatId) {
  return sourceArray(payload)
    .map((message) => normalizeMessage(message, chatId))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function rawMessageChatId(raw) {
  const direct = asId(raw?.chatId) || asId(raw?.chat?.id) || asId(raw?.id?.remote) || asId(raw?.remote);
  if (direct) return direct;
  return asId(raw?.fromMe ? raw?.to : raw?.from);
}

async function readBody(req, maxBytes = 1_000_000) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxBytes) {
      const err = new Error("Corpo da requisição muito grande.");
      err.statusCode = 413;
      throw err;
    }
  }
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch {
    const err = new Error("JSON inválido.");
    err.statusCode = 400;
    throw err;
  }
}

// Fotos sao solicitadas apenas para contatos visiveis e armazenadas
// temporariamente em memoria. Nunca expor a chave WPPConnect no navegador.
// A listagem WPPConnect pode omitir lastMessage. Recuperar um resumo
// dos primeiros chats em segundo plano, sem requisitar 314 históricos a cada
// atualização. Nenhum conteúdo de conversa é gravado no diagnóstico.
const previewCache = new Map();
const previewAttempted = new Map();
const PREVIEW_TTL_MS = 10 * 60_000;
const PREVIEW_LIMIT = 40;
let previewWorkerActive = false;

async function preparePreviews(rawChats) {
  if (previewWorkerActive) return;
  // WPPConnect only supplies full previews for a small fraction of chat rows.
  // Prioritize recent chats by metadata (`t`), not the source array order.
  const eligible = rawChats.map(normalizeChat).filter(Boolean)
    .sort((a, b) => (b.activityAt || b.lastMessage?.timestamp || 0) -
                    (a.activityAt || a.lastMessage?.timestamp || 0))
    .slice(0, PREVIEW_LIMIT)
    .filter((chat) => {
      const known = previewCache.get(chat.id)?.message;
      const latest = known && known.timestamp >= (chat.lastMessage?.timestamp || 0)
        ? known : chat.lastMessage;
      const activity = chat.activityAt || 0;
      // Refresh when WhatsApp indicates activity newer than our preview.
      const stale = !latest || !latest.body || (activity > latest.timestamp + 1000);
      if (!stale) return false;
      const attemptAt = previewAttempted.get(chat.id) || 0;
      return Date.now() - attemptAt >= 25_000;
    })
    .slice(0, 12).map((chat) => chat.id);
  if (!eligible.length) return;
  previewWorkerActive = true;
  let cursor = 0;
  const work = async () => {
    while (cursor < eligible.length) {
      const id = eligible[cursor++];
      previewAttempted.set(id, Date.now());
      try {
        const payload = await callWpp(sessionPath(
          `get-messages/${encodeURIComponent(id)}?count=1&direction=before`
        ), { timeoutMs: 12_000 });
        const messages = normalizeMessageList(payload, id);
        const last = messages[messages.length - 1];
        if (last && (!previewCache.has(id) ||
            last.timestamp >= previewCache.get(id).message.timestamp)) {
          previewCache.set(id, { at: Date.now(), message: last });
        }
      } catch (error) {
        diagnostic("API", "PREVIEW_FETCH_FAILED", { kind: errorKind(error) });
      }
    }
  };
  try {
    await Promise.all([work(), work()]);
    diagnostic("API", "PREVIEW_PREFETCH_COMPLETED", { count: eligible.length });
  } finally {
    previewWorkerActive = false;
  }
}

const avatarCache = new Map();
const AVATAR_TTL_MS = 10 * 60_000;
const AVATAR_MAX_BYTES = 250_000;

function allowedAvatarUrl(candidate) {
  if (typeof candidate !== "string" || candidate.length > 3000) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return null;
    const host = parsed.hostname.toLowerCase();
    if (!["whatsapp.net", "whatsapp.com", "fbcdn.net", "cdninstagram.com"].some(
      (domain) => host === domain || host.endsWith("." + domain)
    )) return null;
    return parsed;
  } catch { return null; }
}

async function loadAvatar(id) {
  const saved = avatarCache.get(id);
  if (saved && Date.now() - saved.at < AVATAR_TTL_MS) return saved.url;
  if (saved) avatarCache.delete(id);
  let image = null;
  try {
    const data = await callWpp(sessionPath(`profile-pic/${encodeURIComponent(id)}${id.endsWith("@g.us") ? "?isGroup=true" : ""}`),
      { timeoutMs: 10_000 });
    const raw = data?.response ?? data;
    const candidate = typeof raw === "string" ? raw :
      raw?.eurl || raw?.url || raw?.profilePicUrl || raw?.imgFull || "";
    let target = allowedAvatarUrl(candidate);
    for (let attempt = 0; attempt < 3 && target; attempt++) {
      const resp = await fetch(target, {
        redirect: "manual", signal: AbortSignal.timeout(8000),
        headers: { Accept: "image/avif,image/webp,image/jpeg,image/png" },
      });
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        target = allowedAvatarUrl(new URL(resp.headers.get("location") || "", target).href);
        continue;
      }
      if (!resp.ok) break;
      const mime = String(resp.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const length = Number(resp.headers.get("content-length") || 0);
      if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(mime) || length > AVATAR_MAX_BYTES) break;
      const bytes = Buffer.from(await resp.arrayBuffer());
      if (bytes.length > 0 && bytes.length <= AVATAR_MAX_BYTES) {
        image = `data:${mime};base64,${bytes.toString("base64")}`;
      }
      break;
    }
  } catch {
    // Contato pode ter a foto privada ou o WPPConnect pode estar desconectado.
  }
  if (avatarCache.size > 800) avatarCache.delete(avatarCache.keys().next().value);
  avatarCache.set(id, { at: Date.now(), url: image });
  diagnostic("API", image ? "AVATAR_LOADED" : "AVATAR_MISSING", { cached: false });
  return image;
}

const pnLidContactCache = new Map();
const eventClients = new Set();
const seenEvents = new Set();
function rememberIncomingPreview(message) {
  if (!message?.chatId || !message?.id) return;
  const previous = previewCache.get(message.chatId)?.message;
  if (!previous || message.timestamp >= previous.timestamp) {
    previewCache.set(message.chatId, { at: Date.now(), message });
  }
}
let pollingEvents = false;

async function pollNewMessages() {
  if (!eventClients.size || pollingEvents || !WPP_SESSION || !WPP_TOKEN) return;
  pollingEvents = true;
  try {
    // O endpoint de novas mensagens exige uma sessao conectada.
    // Durante a leitura do QR, o middleware oficial responde 404 (Disconnected).
    const session = await callWpp(sessionPath("status-session"));
    if (String(session?.status || "").toUpperCase() !== "CONNECTED") return;
    const payload = await callWpp(sessionPath("all-new-messages"));
    for (const raw of sourceArray(payload)) {
      const chatId = rawMessageChatId(raw);
      if (!chatId) continue;
      const message = normalizeMessage(raw, chatId);
      if (!message.body && !raw?.type) continue;
      if (seenEvents.has(message.id)) continue;
      seenEvents.add(message.id);
      rememberIncomingPreview(message);
      if (seenEvents.size > 1500) seenEvents.delete(seenEvents.values().next().value);
      const packet = `data: ${JSON.stringify(message)}\n\n`;
      for (const client of eventClients) {
        try { client.write(packet); } catch {}
      }
    }
  } catch (error) {
    // WPPConnect responde 404 enquanto a sessao esta desconectada.
    // Nao e falha de rota nem motivo para poluir o terminal.
    if (error?.statusCode !== 404) {
      console.error("[Ideal Zap] Falha ao buscar novas mensagens:", error.message);
    }
  } finally {
    pollingEvents = false;
  }
}
setInterval(pollNewMessages, 5000).unref();

// A WPPConnect API pode demorar para criar o navegador e o QR.
 // Enquanto isso, o navegador do WhatsApp nao pode ser aberto duas vezes
 // com o mesmo userDataDir. Serializamos/restringimos novos starts.
let startingSession = false;
let sessionManuallyClosed = false;
let lastStartAt = 0;
let latestQr = null; // QR temporario so em memoria (nunca gravar em logs/disco).
// O WPPConnect aguarda ate 120s pela leitura. Evitar nova sessao
// enquanto o navegador antigo pode ainda usar o mesmo perfil Chromium.
const START_COOLDOWN_MS = 135_000;
const QR_LIFETIME_MS = 90_000;

function qrDataUri(input) {
  if (typeof input !== "string") return null;
  const encoded = input.replace(/^data:image\/png;base64,/, "");
  if (encoded.length < 200 || encoded.length > 400_000 || !/^[A-Za-z0-9+/=]+$/.test(encoded)) return null;
  const png = Buffer.from(encoded, "base64");
  if (png.length < 200 || png.length > 300_000 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
  return `data:image/png;base64,${encoded}`;
}

function recentQr() {
  return latestQr && (Date.now() - latestQr.at < QR_LIFETIME_MS) ? latestQr.data : null;
}

function validBridgeKey(given) {
  if (!QR_BRIDGE_SECRET || typeof given !== "string") return false;
  const expected = Buffer.from(QR_BRIDGE_SECRET);
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function requestSessionStart() {
  const current = await callWpp(sessionPath("status-session"));
  const status = String(current?.status || "CLOSED").toUpperCase();

  diagnostic("API", "START_REQUEST", { status, webhookEnabled: Boolean(QR_BRIDGE_URL), alreadyStarting: startingSession });
  if (["CONNECTED", "QRCODE", "INITIALIZING", "PHONECODE"].includes(status) || recentQr()) {
    diagnostic("API", "START_SKIPPED_ACTIVE", { status, qrStillValid: Boolean(recentQr()) });
    return { ok: true, started: false, status: recentQr() ? "QRCODE" : status,
      message: "A sessão já está iniciando ou aguardando leitura." };
  }

  if (startingSession || Date.now() - lastStartAt < START_COOLDOWN_MS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((START_COOLDOWN_MS - (Date.now() - lastStartAt)) / 1000));
    diagnostic("API", "START_SKIPPED_COOLDOWN", { running: startingSession, retryAfterSeconds });
    return {
      ok: true, started: false, status: "INITIALIZING", retryAfterSeconds,
      message: `Aguarde ${retryAfterSeconds}s antes de gerar um novo QR Code.`,
    };
  }

  lastStartAt = Date.now();
  startingSession = true;
  diagnostic("API", "START_SENT_TO_WPP", { webhookEnabled: Boolean(QR_BRIDGE_URL) });
  // O QR chega pelo callback ou pela captura protegida do terminal.
  // A resposta de start-session retorna antes da geração da imagem; não
  // presumir que status CLOSED signifique que o navegador já foi encerrado.
  void callWpp(sessionPath("start-session"), {
    method: "POST", body: { waitQrCode: false, ...(QR_BRIDGE_URL ? { webhook: QR_BRIDGE_URL } : {}) }, timeoutMs: 75_000,
  }).then((result) => {
    const qr = qrDataUri(result?.qrcode);
    diagnostic("API", "START_RESPONSE", { status: String(result?.status || "UNKNOWN").toUpperCase(), qrInResponse: Boolean(qr) });
    if (qr) {
      latestQr = { data: qr, at: Date.now() };
      diagnostic("API", "QR_RECEIVED_RESPONSE", { valid: true });
      console.log("[Ideal Zap] QR Code recebido do WPPConnect para a interface.");
    }
  }).catch((error) => {
    diagnostic("API", "START_REQUEST_FAILED", { kind: errorKind(error) });
    console.error("[Ideal Zap] Falha ao iniciar WhatsApp:", error.message);
  }).finally(() => {
    startingSession = false;
    diagnostic("API", "START_REQUEST_ENDED", { cachedQr: Boolean(recentQr()) });
  });

  return { ok: true, started: true, status: "INITIALIZING", message: "Preparando QR Code..." };
}

async function fetchQrImage() {
  // Fallback oficial: /qrcode-session responde image/png; nunca expor token.
  try {
    const response = await fetch(`${WPP_BASE_URL}${sessionPath("qrcode-session")}`, {
      headers: { Authorization: authHeader(), Accept: "image/png" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok || !String(response.headers.get("content-type") || "").toLowerCase().startsWith("image/png")) {
      diagnostic("API", "QR_PNG_ENDPOINT_MISSING", { httpStatus: response.status });
      return null;
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 300_000) return null;
    const image = Buffer.from(await response.arrayBuffer());
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (image.length < 200 || image.length > 300_000 || !image.subarray(0, 8).equals(pngSignature)) {
      return null;
    }
    diagnostic("API", "QR_PNG_ENDPOINT_OK", { qrValid: true });
    return `data:image/png;base64,${image.toString("base64")}`;
  } catch (error) {
    diagnostic("API", "QR_PNG_ENDPOINT_ERROR", { kind: errorKind(error) });
    return null;
  }
}

let lastConnectionLog = "";
let lastConnectionLogAt = 0;
function traceConnection(status, qrCode, source) {
  const signature = `${status}:${Boolean(qrCode)}:${source}`;
  if (signature !== lastConnectionLog || Date.now() - lastConnectionLogAt > 25_000) {
    lastConnectionLog = signature;
    lastConnectionLogAt = Date.now();
    diagnostic("API", "CONNECTION_RESPONSE", { status, qrPresent: Boolean(qrCode), source });
  }
}

const server = createServer(async (req, res) => {
  // Requests from another website must never control a local WhatsApp session.
  if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) {
    return json(res, 403, { error: "Origem não autorizada." });
  }
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url || "/", "http://127.0.0.1");
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname === "/health") {
      return json(res, 200, {
        ok: true,
        integrationVersion: "qr-bridge-v1",
        qrBridgeConfigured: Boolean(QR_BRIDGE_URL),
        configured: Boolean(WPP_SESSION && WPP_TOKEN),
        wppBaseUrl: WPP_BASE_URL,
        session: WPP_SESSION || null,
        tokenConfigured: Boolean(WPP_TOKEN),
      });
    }

    // A interface relata SOMENTE eventos tecnicos permitidos. Nenhum texto livre.
    if (pathname === "/internal/client-diagnostic" && req.method === "POST") {
      const peer = req.socket.remoteAddress;
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer) ||
          !req.headers.origin || !allowedOrigins.includes(req.headers.origin)) {
        return json(res, 403, { error: "Origem não autorizada." });
      }
      const message = await readBody(req);
      const allowedEvents = new Set(["POLL_OK", "POLL_FAILED", "START_CLICKED", "START_OK", "START_FAILED", "QR_IMAGE_LOADED", "QR_IMAGE_FAILED", "UI_READY", "HISTORY_OPENED", "HISTORY_DATA_READY", "HISTORY_DOM_MOUNTED", "HISTORY_ERROR", "UI_RENDER_ERROR", "UI_ROOT_ERROR", "UI_SERVER_ERROR"]);
      if (allowedEvents.has(message?.event)) {
        const status = typeof message?.status === "string" ? message.status : "UNKNOWN";
        const isRenderError = message.event === "UI_RENDER_ERROR" || message.event === "UI_ROOT_ERROR" ||
          message.event === "UI_SERVER_ERROR";
        const knownReasons = new Set(["REACT_CHILD_OBJECT", "REACT_HOOK", "REACT_RECURSION",
          "MISSING_VALUE", "HYDRATION", "DOM_ERROR", "INVALID_DATE", "OTHER_RENDER_ERROR"]);
        const knownComponents = new Set(["MessageList", "MessageBubble", "MediaView", "ChatHeader",
          "ChatList", "ContactAvatar", "Composer", "WhatsAppConnection", "Index",
          "RootComponent", "Unknown"]);
        diagnostic("WEB", message.event, {
          status: isRenderError ? (knownReasons.has(status) ? status : "OTHER_RENDER_ERROR") : status,
          component: isRenderError && knownComponents.has(message.component) ? message.component : "Unknown",
          qrPresent: message?.qrPresent === true,
          httpStatus: Number.isInteger(message?.httpStatus) ? message.httpStatus : 0,
        });
      }
      return json(res, 200, { ok: true });
    }

    // Webhook interno do WPPConnect: recebe imagem QR por evento, sem expor
    // credenciais no frontend. Somente POST do proprio computador autenticado.
    if (pathname === "/internal/wpp-hook" && req.method === "POST") {
      const peer = req.socket.remoteAddress;
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer) ||
          !validBridgeKey(url.searchParams.get("key"))) {
        diagnostic("API", "WEBHOOK_REJECTED_AUTH", {});
        return json(res, 403, { error: "Webhook não autorizado." });
      }
      const event = await readBody(req);
      diagnostic("API", "WEBHOOK_RECEIVED", {
        event: event?.event === "qrcode" ? "QRCODE" : event?.event === "session-logged" ? "SESSION_LOGGED" : "OTHER",
        sessionMatches: event?.session === WPP_SESSION,
        qrFieldPresent: typeof event?.qrcode === "string",
      });
      if (event?.session === WPP_SESSION && event?.event === "qrcode") {
        const qr = qrDataUri(event?.qrcode);
        if (qr) {
          latestQr = { data: qr, at: Date.now() };
          diagnostic("API", "WEBHOOK_QR_OK", { qrValid: true });
          console.log("[Ideal Zap] QR Code recebido pelo canal local.");
          return json(res, 200, { ok: true, received: true });
        }
        diagnostic("API", "WEBHOOK_QR_INVALID", { qrFieldPresent: typeof event?.qrcode === "string" });
        return json(res, 400, { error: "Imagem do QR inválida." });
      }
      // The original WPPConnect webhook sends {event,session,...message},
      // while the legacy Ideal patch sends {event,session,message}.
      // Accept both without passing any token or pairing secret to the browser.
      if (event?.session === WPP_SESSION && event?.event === "onmessage") {
        const raw = event?.message && typeof event.message === "object" && !Array.isArray(event.message)
          ? event.message : event;
        if (raw.fromMe !== true && raw.id?.fromMe !== true) {
          const chatId = rawMessageChatId(raw);
          if (/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(chatId)) {
            const message = normalizeMessage(raw, chatId);
            if (!seenEvents.has(message.id)) {
              seenEvents.add(message.id);
              rememberIncomingPreview(message);
              if (seenEvents.size > 1500) seenEvents.delete(seenEvents.values().next().value);
              const packet = `data: ${JSON.stringify(message)}\n\n`;
              for (const client of eventClients) {
                try { client.write(packet); } catch {}
              }
              diagnostic("API", "INCOMING_EVENT_RELAYED", { listeners: eventClients.size,
                hasMedia: Boolean(message.mediaType), source: event.message ? "LEGACY" : "NATIVE" });
            }
          } else diagnostic("API", "INCOMING_EVENT_DROPPED", { reason: "CHAT_ID_INVALID" });
        }
        return json(res, 200, { ok: true });
      }
      if (event?.session === WPP_SESSION &&
          ["session-logged", "status", "onstatechange"].includes(event?.event) &&
          event?.status === "CONNECTED") {
        latestQr = null;
        diagnostic("API", "SESSION_CONNECTED_BY_HOOK", {});
      }
      return json(res, 200, { ok: true });
    }

    // Diagnostico sem QR, token, urlcode ou segredos para suporte.
    if (req.method === "GET" && pathname === "/connection/diagnostics") {
      let wppStatus = "UNAVAILABLE";
      let wppError = null;
      if (WPP_SESSION && WPP_TOKEN) {
        try {
          const session = await callWpp(sessionPath("status-session"));
          wppStatus = String(session?.status || "UNKNOWN").toUpperCase();
        } catch (error) {
          wppError = Number(error?.statusCode) || "NETWORK_ERROR";
        }
      }
      return json(res, 200, {
        apiVersion: "qr-bridge-v1",
        sessionConfigured: Boolean(WPP_SESSION && WPP_TOKEN),
        bridgeConfigured: Boolean(QR_BRIDGE_URL),
        wppStatus,
        wppError,
        cachedQrAvailable: Boolean(recentQr()),
        lastQrAgeSeconds: latestQr ? Math.floor((Date.now() - latestQr.at) / 1000) : null,
        startPending: startingSession,
      });
    }

    if (req.method === "GET" && pathname === "/status") {
      const status = await callWpp(sessionPath("status-session"));
      return json(res, 200, status);
    }

    // Only expose public connection state and the short-lived pairing QR to the UI.
    // Never forward urlcode, tokens or other internal WPPConnect data to the browser.
    if (req.method === "GET" && pathname === "/connection") {
      if (!WPP_SESSION || !WPP_TOKEN) {
        traceConnection("NOT_CONFIGURED", null, "NO_TOKEN");
        return json(res, 200, {
          status: "NOT_CONFIGURED",
          qrCode: null,
          message: "Execute PREPARAR_AMBIENTE.bat e depois INICIAR.bat.",
        });
      }
      try {
        const session = await callWpp(sessionPath("status-session"));
        const status = String(session?.status || "UNKNOWN").toUpperCase();
        if (status === "CONNECTED") latestQr = null;
        const fromStatus = qrDataUri(session?.qrcode);
        // Captura o PNG mesmo quando o WPPConnect acabou de mudar para
        // INITIALIZING; um segundo caminho vem da resposta waitQrCode:true.
        const qrFromEndpoint = status === "QRCODE" && !fromStatus ? await fetchQrImage() : null;
        const qrCode = status === "CONNECTED" ? null : (
          fromStatus || qrFromEndpoint ||
          (["QRCODE", "INITIALIZING", "CLOSED"].includes(status) ? recentQr() : null)
        );
        if (qrCode && (!latestQr || latestQr.data !== qrCode)) {
          latestQr = { data: qrCode, at: Date.now() };
        }
        traceConnection(qrCode ? "QRCODE" : status, qrCode,
          fromStatus ? "STATUS" : qrFromEndpoint ? "PNG_ENDPOINT" : qrCode ? "WEBHOOK_CACHE" : "NONE");
        return json(res, 200, {
          status: qrCode ? "QRCODE" : status,
          qrCode,
          manualClose: sessionManuallyClosed,
          message: !QR_BRIDGE_URL ? "Canal de QR nao configurado. Feche os serviços e execute INICIAR.bat novamente." :
            status === "INITIALIZING" && !qrCode ? "Iniciando WhatsApp..." :
            status === "QRCODE" && !qrCode ? "Aguardando o QR Code ficar disponível..." :
            status === "ERROR" ? "Falha ao iniciar a sessão. Feche serviços antigos e tente novamente." : null,
        });
      } catch (error) {
        const cached = recentQr();
        diagnostic("API", "CONNECTION_STATUS_ERROR", { kind: errorKind(error), cachedQr: Boolean(cached) });
        traceConnection(cached ? "QRCODE" : "OFFLINE", cached, "STATUS_ERROR");
        return json(res, 200, {
          status: cached ? "QRCODE" : "OFFLINE",
          qrCode: cached,
          message: cached ? null : "Não foi possível consultar a sessão. Confira o WPPConnect na porta 8788 e o token do backend.",
        });
      }
    }

    if (req.method === "POST" && pathname === "/connection/start") {
      requireConfig();
      sessionManuallyClosed = false;
      return json(res, 202, await requestSessionStart());
    }

    // Original WPPConnect session operations. close preserves stored pairing;
    // logout intentionally unlinks and clears only the WPP session data.
    if (req.method === "POST" && pathname === "/connection/close") {
      requireConfig();
      if (startingSession) return json(res, 409, { error: "Sessão está iniciando. Tente novamente." });
      const result = await callWpp(sessionPath("close-session"), {
        method: "POST", body: {}, timeoutMs: 30_000,
      });
      if (result?.status !== true) return json(res, 502, { error: "O WPPConnect não confirmou o encerramento." });
      latestQr = null;
      sessionManuallyClosed = true;
      diagnostic("API", "SESSION_CLOSED", { pairingPreserved: true });
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/connection/relink") {
      requireConfig();
      const body = await readBody(req);
      if (body?.confirmation !== "DESVINCULAR") {
        return json(res, 400, { error: "Confirmação de desvinculação inválida." });
      }
      if (startingSession) return json(res, 409, { error: "Sessão está iniciando. Tente novamente." });
      const result = await callWpp(sessionPath("logout-session"), {
        method: "POST", body: {}, timeoutMs: 35_000,
      });
      if (result?.status !== true) return json(res, 502, { error: "O WPPConnect não confirmou a desvinculação." });
      latestQr = null;
      lastStartAt = 0;
      sessionManuallyClosed = false;
      diagnostic("API", "SESSION_UNLINKED", { pairingRemoved: true });
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && pathname === "/events") {
      requireConfig();
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write(": Ideal Zap conectado\n\n");
      eventClients.add(res);
      const heartbeat = setInterval(() => {
        try { res.write(": keepalive\n\n"); } catch {}
      }, 20000);
      res.on("close", () => {
        clearInterval(heartbeat);
        eventClients.delete(res);
      });
      return;
    }

    const avatarMatch = pathname.match(/^\/avatars\/([^/]+)$/);
    if (req.method === "GET" && avatarMatch) {
      const id = decodeURIComponent(avatarMatch[1]);
      if (!/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(id)) {
        return json(res, 400, { error: "Contato inválido." });
      }
      const url = await loadAvatar(id);
      return json(res, 200, { url });
    }

    if (req.method === "GET" && pathname === "/chats") {
      let rawChats = [];
      let source = "LIST_CHATS";
      let firstError = null;
      try {
        rawChats = sourceArray(await callWpp(sessionPath("list-chats"),
          { method: "POST", body: {} }));
      } catch (error) {
        firstError = error;
        diagnostic("API", "LIST_CHATS_FAILED", { kind: errorKind(error) });
      }
      // Fallback para a rota legada usada pelo Manager 2.0.0.
      if (!rawChats.length) {
        try {
          rawChats = sourceArray(await callWpp(sessionPath("all-chats")));
          source = "ALL_CHATS";
        } catch (error) {
          diagnostic("API", "ALL_CHATS_FAILED", { kind: errorKind(error) });
          if (firstError) throw firstError;
          throw error;
        }
      }
      const chats = rawChats.map(normalizeChat).filter(Boolean).map((item) => {
        const saved = previewCache.get(item.id);
        const cached = saved && Date.now() - saved.at < PREVIEW_TTL_MS ? saved.message : null;
        return {
          ...item,
          activityAt: Math.max(item.activityAt || 0, cached?.timestamp || 0,
            item.lastMessage?.timestamp || 0),
          lastMessage: cached && (!item.lastMessage || cached.timestamp >= item.lastMessage.timestamp)
            ? cached : item.lastMessage,
        };
      });
      const previews = chats.filter((item) => item.lastMessage && item.lastMessage.body).length;
      void preparePreviews(rawChats).catch(() => {});
      diagnostic("API", "CHATS_LOADED", { raw: rawChats.length, normalized: chats.length, withPreview: previews, source });
      return json(res, 200, chats);
    }

    if (req.method === "GET" && (pathname === "/contacts" || pathname === "/groups")) {
      const endpoint = pathname === "/contacts" ? "all-contacts" : "all-groups";
      const data = sourceArray(await callWpp(sessionPath(endpoint)));
      const contactsOnly = pathname === "/contacts";
      const flagged = contactsOnly ? data.filter((record) =>
        typeof record?.isMyContact === "boolean") : [];
      const filtered = flagged.length ? data.filter((record) =>
        record?.isMyContact === true || (typeof record?.isMyContact !== "boolean" &&
          typeof record?.name === "string" && record.name.length > 0)) : data;
      // A lista WPPConnect pode repetir o mesmo contato com o mesmo ID.
      // Preferir registro com nome salvo e telefone conhecido.
      const unique = new Map();
      for (const item of filtered.map(normalizeChat).filter(Boolean)) {
        const old = unique.get(item.id);
        const score = (chat) => Number(Boolean(chat.contact.name && chat.contact.name !== chat.contact.phone)) * 2 +
          Number(Boolean(chat.contact.phone)) + Number(Boolean(chat.contact.avatarUrl));
        if (!old || score(item) > score(old)) unique.set(item.id, item);
      }
      // O mesmo contato pode aparecer como numero @c.us e como LID.
      // Deduplicar SOMENTE pares inequivocos: mesmo nome salvo completo
      // + exatamente um LID e um c.us. Preservar nomes ambiguos repetidos.
      const candidates = [...unique.values()];
      const byName = new Map();
      if (contactsOnly) for (const chat of candidates) {
        const name = chat.contact.name.trim().normalize("NFKC").toLocaleLowerCase("pt-BR");
        if (name.length < 6 || /^\\+?\\d+$/.test(name) ||
            name === "contato do whatsapp" || name === "grupo do whatsapp") continue;
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push(chat);
      }
      const discard = new Set();
      if (contactsOnly) for (const sameName of byName.values()) {
        const lid = sameName.filter((chat) => chat.id.endsWith("@lid"));
        const phone = sameName.filter((chat) => chat.id.endsWith("@c.us"));
        // Mesmo nome sozinho nao e identidade. Um par com duas origens e
        // forte indicio, mas nao juntamos casos com 3+ registros.
        if (sameName.length === 2 && lid.length === 1 && phone.length === 1)
          discard.add(lid[0].id);
      }
      let chats = candidates.filter((chat) => !discard.has(chat.id));
      // WPPConnect stores some contacts twice under phone JID and LID,
      // even when saved/push names differ. Ask its official PN/LID API
      // for any remaining LIDs instead of merging by similar names.
      let verifiedPairs = 0;
      if (contactsOnly) {
        const match = await collapseMappedContacts(chats, async (lid) => {
          const now = Date.now();
          const cached = pnLidContactCache.get(lid);
          if (cached && now - cached.at < (cached.pn ? 20 * 60_000 : 2 * 60_000)) return cached.pn;
          let pn = "";
          try {
            const entry = await callWpp(sessionPath("contact/pn-lid/" + encodeURIComponent(lid)),
              { timeoutMs: 1500 });
            pn = phoneFromPnLidEntry(entry, lid);
          } catch { /* no mapping: preserve the contact */ }
          pnLidContactCache.set(lid, { pn, at: now });
          if (pnLidContactCache.size > 1500)
            pnLidContactCache.delete(pnLidContactCache.keys().next().value);
          return pn;
        }, { maxLookups: 30, concurrency: 5,
          isCached: (id) => {
            const entry = pnLidContactCache.get(id);
            return Boolean(entry && Date.now() - entry.at < (entry.pn ? 20 * 60_000 : 2 * 60_000));
          }, });
        chats = match.contacts;
        verifiedPairs = match.mappedPairs;
        diagnostic("API", "CONTACT_LID_CHECK", {
          verifiedPairs, checked: match.lookedUp, deferred: match.unresolvedLids,
        });
      }
      diagnostic("API", contactsOnly ? "CONTACTS_LOADED" : "GROUPS_LOADED",
        { raw: data.length, normalized: chats.length,
          duplicatesRemoved: filtered.length - chats.length,
          lidPairsCollapsed: discard.size + verifiedPairs,
          savedFlagPresent: flagged.length > 0 });
      return json(res, 200, chats);
    }

    const previewRoute = pathname.match(/^\/chats\/([^/]+)\/preview$/);
    if (req.method === "GET" && previewRoute) {
      const id = decodeURIComponent(previewRoute[1]);
      if (!/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(id)) {
        return json(res, 400, { error: "Conversa inválida." });
      }
      const cached = previewCache.get(id);
      if (cached && Date.now() - cached.at < PREVIEW_TTL_MS) {
        return json(res, 200, { lastMessage: cached.message });
      }
      try {
        const history = await callWpp(sessionPath(
          `get-messages/${encodeURIComponent(id)}?count=1&direction=before`
        ), { timeoutMs: 12_000 });
        const items = normalizeMessageList(history, id);
        const lastMessage = items[items.length - 1] || null;
        if (lastMessage) previewCache.set(id, { at: Date.now(), message: lastMessage });
        return json(res, 200, { lastMessage });
      } catch (error) {
        diagnostic("API", "PREVIEW_ON_DEMAND_FAILED", { kind: errorKind(error) });
        return json(res, 200, { lastMessage: null });
      }
    }

    const actionMatch = pathname.match(/^\/chats\/([^/]+)\/(read-state|archive)$/);
    if (req.method === "POST" && actionMatch) {
      const chatId = decodeURIComponent(actionMatch[1]);
      if (!/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(chatId))
        return json(res, 400, { error: "Conversa inválida." });
      const data = await readBody(req);
      if (actionMatch[2] === "read-state") {
        if (typeof data.unread !== "boolean")
          return json(res, 400, { error: "Estado de leitura inválido." });
        const endpoint = data.unread ? "mark-unseen" : "send-seen";
        await callWpp(sessionPath(endpoint), { method: "POST",
          body: { phone: data.unread ? chatId : [chatId],
            isGroup: chatId.endsWith("@g.us") } });
        diagnostic("API", data.unread ? "CHAT_UNREAD_SET" : "CHAT_READ_SET", {});
      } else {
        if (typeof data.archive !== "boolean")
          return json(res, 400, { error: "Arquivamento inválido." });
        await callWpp(sessionPath("archive-chat"), { method: "POST",
          body: { phone: chatId, isGroup: chatId.endsWith("@g.us"), value: data.archive } });
        diagnostic("API", "CHAT_ARCHIVE_CHANGED", { archive: data.archive });
      }
      return json(res, 200, { ok: true });
    }

    // Manager WPPConnect v2.10.61: leitura de detalhes do grupo,
    // etiquetas Business e silenciamento. Dados nunca entram no log.
    const groupInfoRoute = pathname.match(/^\/manager\/group-info\/([^/]+)$/);
    if (req.method === "GET" && groupInfoRoute) {
      const id = decodeURIComponent(groupInfoRoute[1]);
      if (!/^[0-9-]{7,45}@g\.us$/.test(id))
        return json(res, 400, { error: "Grupo inválido." });
      try {
        const result = await callWpp(sessionPath(`group-info/${encodeURIComponent(id)}`), { timeoutMs: 14_000 });
        const raw = result?.response ?? result?.data ?? result;
        const members = Array.isArray(raw?.participants) ? raw.participants : [];
        const participants = members.slice(0, 200).map((item) => ({
          id: asId(item?.id || item?.contactId || item?.wid).slice(0, 90),
          admin: Boolean(item?.isAdmin || item?.isSuperAdmin || item?.admin),
        })).filter((item) => Boolean(item.id));
        diagnostic("API", "GROUP_INFO_LOADED", { members: participants.length });
        return json(res, 200, {
          name: safeMessageText(raw?.name || raw?.subject).slice(0, 120),
          description: safeMessageText(raw?.description || raw?.desc).slice(0, 600),
          participants, count: members.length,
        });
      } catch (error) {
        diagnostic("API", "GROUP_INFO_FAILED", { kind: errorKind(error) });
        return json(res, 502, { error: "Não foi possível consultar o grupo no WPPConnect." });
      }
    }

    if (req.method === "GET" && pathname === "/manager/labels") {
      try {
        const raw = sourceArray(await callWpp(sessionPath("get-all-labels"), { timeoutMs: 12_000 }));
        const labels = raw.slice(0, 150).map((item) => ({
          id: asText(item?.id || item?.labelId).slice(0, 50),
          name: safeMessageText(item?.name || item?.labelName).slice(0, 80),
        })).filter((item) => item.id && item.name);
        diagnostic("API", "LABELS_LOADED", { count: labels.length });
        return json(res, 200, labels);
      } catch (error) {
        diagnostic("API", "LABELS_FAILED", { kind: errorKind(error) });
        return json(res, 502, { error: "Etiquetas indisponíveis nesta conta ou sessão." });
      }
    }

    if (req.method === "POST" && pathname === "/manager/labels") {
      const body = await readBody(req);
      if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 70)
        return json(res, 400, { error: "Informe um nome de etiqueta válido." });
      await callWpp(sessionPath("add-new-label"), {
        method: "POST", body: { name: body.name.trim(), options: { labelColor: 4292849392 } },
      });
      diagnostic("API", "LABEL_CREATED", {});
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/manager/label-chat") {
      const body = await readBody(req);
      if (typeof body.chatId !== "string" ||
          !/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(body.chatId) ||
          typeof body.labelId !== "string" || !/^[A-Za-z0-9_-]{1,50}$/.test(body.labelId) ||
          !["add", "remove"].includes(body.mode))
        return json(res, 400, { error: "Etiqueta ou conversa inválida." });
      await callWpp(sessionPath("add-or-remove-label"), {
        method: "POST", body: { chatIds: [body.chatId],
          options: [{ labelId: body.labelId, type: body.mode }] },
      });
      diagnostic("API", "CHAT_LABEL_CHANGED", { added: body.mode === "add" });
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/contacts/share") {
      const body = await readBody(req);
      if (typeof body.chatId !== "string" ||
          !/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(body.chatId) ||
          typeof body.contactId !== "string" || !/^[0-9]{7,15}(?:@c\.us)?$/.test(body.contactId) ||
          typeof body.name !== "string" || !body.name.trim() || body.name.length > 120)
        return json(res, 400, { error: "Selecione um contato com telefone e nome válidos." });
      const target = body.contactId.replace(/@c\.us$/, "");
      try {
        await callWpp(sessionPath("contact-vcard"), { method: "POST",
          body: { phone: body.chatId, isGroup: body.chatId.endsWith("@g.us"),
            name: body.name.trim(), contactsId: [target] } });
        diagnostic("API", "CONTACT_CARD_SENT", { group: body.chatId.endsWith("@g.us") });
        return json(res, 200, { ok: true });
      } catch (error) {
        diagnostic("API", "CONTACT_CARD_FAILED", { kind: errorKind(error) });
        return json(res, 502, { error: "O WhatsApp não conseguiu enviar o cartão de contato." });
      }
    }

    const pinRoute = pathname.match(/^\/chats\/([^/]+)\/pin$/);
    if (req.method === "POST" && pinRoute) {
      const chatId = decodeURIComponent(pinRoute[1]);
      const body = await readBody(req);
      if (!/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(chatId) ||
          typeof body.pinned !== "boolean")
        return json(res, 400, { error: "Conversa ou estado de fixação inválido." });
      await callWpp(sessionPath("pin-chat"), { method: "POST",
        body: { phone: [chatId], isGroup: chatId.endsWith("@g.us"),
          state: body.pinned ? "true" : "false" } });
      diagnostic("API", "CHAT_PIN_CHANGED", { pinned: body.pinned });
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/contacts/save") {
      const { phone, name } = await readBody(req);
      if (typeof phone !== "string" || !/^\+[0-9]{7,15}$/.test(phone) ||
          typeof name !== "string" || !name.trim() || name.length > 100)
        return json(res, 400, { error: "Informe nome e telefone válidos." });
      try {
        const result = await callWpp(sessionPath("ideal-save-contact"), { method: "POST",
          body: { phone: phone.slice(1) + "@c.us", name: name.trim() } });
        if (result?.response?.saved !== true) throw new Error("Not confirmed");
        diagnostic("API", "PHONE_CONTACT_SAVE_CONFIRMED", {});
        return json(res, 200, { ok: true });
      } catch {
        return json(res, 502, { error: "O WhatsApp não confirmou o salvamento. Verifique a conexão e se a sincronização de contatos está disponível no telefone." });
      }
    }

    if (req.method === "POST" && pathname === "/forward") {
      const body = await readBody(req);
      const destinations = Array.isArray(body.destinations) ? body.destinations : [body.destination];
      if (typeof body.messageId !== "string" || !/^[A-Za-z0-9_@.:-]{1,250}$/.test(body.messageId) ||
          destinations.length < 1 || destinations.length > 5 ||
          !destinations.every((id) => typeof id === "string" &&
            (/^[0-9]{7,15}@c\.us$/.test(id) ||
              /^[0-9]{7,30}@lid$/.test(id) ||
              /^[0-9-]{7,45}@g\.us$/.test(id))) ||
          new Set(destinations).size !== destinations.length)
        return json(res, 400, { error: "Selecione entre um e cinco destinos válidos." });
      let sent = 0;
      let copiedAsText = 0;
      for (const destination of destinations) {
        try {
          const result = await callWpp(sessionPath("forward-messages"), { method: "POST",
            body: { phone: destination, isGroup: destination.endsWith("@g.us"),
              messageId: body.messageId } });
          if (result?.response?.forwarded !== true) throw new Error("Forward not confirmed");
          sent += 1;
        } catch (error) {
          diagnostic("API", "MESSAGE_FORWARD_WPP_ERROR", { kind: errorKind(error) });
          diagnostic("API", "MESSAGE_FORWARD_FAILED", { sent, total: destinations.length,
            kind: errorKind(error) });
          return json(res, 502, { error: sent
            ? `Encaminhado para ${sent} de ${destinations.length} destinos. Os demais falharam.`
            : "Não foi possível encaminhar a mensagem." });
        }
      }
      diagnostic("API", "MESSAGE_FORWARDED", { sent, total: destinations.length });
      return json(res, 200, { ok: true, sent, copiedAsText });
    }

    if (req.method === "POST" && pathname === "/reply") {
      const data = await readBody(req);
      const chatId = data.chatId;
      const messageId = data.messageId;
      const message = data.message;
      if (typeof chatId !== "string" ||
          !/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(chatId) ||
          typeof messageId !== "string" || messageId.length > 250 ||
          !/^[A-Za-z0-9_@.:-]+$/.test(messageId) ||
          typeof message !== "string" || !message.trim() || message.length > 4000) {
        return json(res, 400, { error: "Resposta citada inválida." });
      }
      await callWpp(sessionPath("send-reply"), { method: "POST",
        body: { phone: [chatId], isGroup: chatId.endsWith("@g.us"), message, messageId } });
      diagnostic("API", "REPLY_SENT", { successful: true });
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/message-action") {
      const body = await readBody(req);
      if (!["edit", "delete", "star"].includes(body.action) ||
          typeof body.messageId !== "string" ||
          !/^[A-Za-z0-9_@.:-]{1,250}$/.test(body.messageId))
        return json(res, 400, { error: "Mensagem ou operação inválida." });
      if (body.action === "edit") {
        if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 4000)
          return json(res, 400, { error: "Digite o novo texto da mensagem." });
        await callWpp(sessionPath("edit-message"), { method: "POST",
          body: { id: body.messageId, newText: body.text.trim() } });
      } else if (body.action === "delete") {
        if (typeof body.chatId !== "string" ||
            !/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(body.chatId) ||
            typeof body.onlyLocal !== "boolean")
          return json(res, 400, { error: "Identificador de conversa inválido." });
        if (!body.onlyLocal && !body.messageId.startsWith("true_")) {
          return json(res, 400, { error: "Apagar para todos só está disponível para mensagens enviadas por você." });
        }
        let revokePending = false;
        try {
          const result = await callWpp(sessionPath("ideal-delete-message"), {
            method: "POST", timeoutMs: 20_000,
            body: { messageId: body.messageId, onlyLocal: body.onlyLocal },
          });
          const confirmed = result?.response?.confirmed === true;
          revokePending = !body.onlyLocal && result?.response?.submitted === true;
          if (!confirmed && !revokePending) throw new Error("Not confirmed");
        } catch (error) {
          diagnostic("API", "MESSAGE_DELETE_FAILED", {
            kind: errorKind(error), onlyLocal: body.onlyLocal,
            reason: error?.safeReason || "unknown",
          });
          return json(res, 502, { error: body.onlyLocal
            ? "O WhatsApp não confirmou a exclusão para você."
            : "O WhatsApp não aceitou a solicitação de exclusão para todos." });
        }
        diagnostic("API", revokePending ? "MESSAGE_REVOKE_PENDING" : "MESSAGE_DELETE_CONFIRMED",
          { onlyLocal: body.onlyLocal });
        if (revokePending) return json(res, 200, { ok: true, pending: true });
      } else {
        if (typeof body.star !== "boolean")
          return json(res, 400, { error: "Favorito inválido." });
        diagnostic("API", "STAR_ATTEMPT", { requested: true });
        let starResult;
        try {
          starResult = await callWpp(sessionPath("star-message"), { method: "POST",
            body: { messageId: body.messageId, star: body.star } });
        } catch (error) {
          diagnostic("API", "STAR_WPP_FAILED", { kind: errorKind(error) });
          throw error;
        }
        const outcome = starResult?.response ?? starResult?.data ?? starResult;
        if (outcome === false || outcome === 0) {
          diagnostic("API", "MESSAGE_STAR_NO_CHANGE", { star: body.star });
          return json(res, 502, { error: "O WhatsApp não confirmou a alteração de favorito." });
        }
      }
      diagnostic("API", "MESSAGE_ACTION_OK", { action: body.action });
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/reaction") {
      const data = await readBody(req);
      if (typeof data.messageId !== "string" || data.messageId.length > 250 ||
          !/^[A-Za-z0-9_@.:-]+$/.test(data.messageId) ||
          typeof data.reaction !== "string" || data.reaction.length > 16) {
        return json(res, 400, { error: "Reação inválida." });
      }
      await callWpp(sessionPath("react-message"), { method: "POST",
        body: { msgId: data.messageId, reaction: data.reaction } });
      diagnostic("API", "REACTION_SENT", { successful: true });
      return json(res, 200, { ok: true });
    }

    const match = pathname.match(/^\/chats\/([^/]+)\/messages$/);
    if (match && req.method === "GET") {
      const chatId = decodeURIComponent(match[1]);
      // Os identificadores sao opacos: nunca escrever IDs, telefone ou grupos nos logs.
      if (!/^[A-Za-z0-9_.:-]{1,120}@[A-Za-z0-9.-]{1,50}$/.test(chatId)) {
        diagnostic("API", "HISTORY_BAD_IDENTIFIER", { length: chatId.length });
        return json(res, 400, { error: "Identificador de conversa inválido." });
      }
      const count = Math.max(1, Math.min(100, Number(url.searchParams.get("count")) || 80));
      const encoded = encodeURIComponent(chatId);
      diagnostic("API", "HISTORY_REQUESTED", { group: chatId.endsWith("@g.us"), lid: chatId.endsWith("@lid") });
      let items = [];
      let source = "GET_MESSAGES";
      let getError = null;

      // get-messages e a API atual do WPPConnect 2.10.61. O Manager antigo
      // usa all-messages-in-chat, que pode responder erro ou lista vazia
      // dependendo do ID @lid, grupo e estado de sincronizacao.
      try {
        items = normalizeMessageList(await callWpp(sessionPath(
          `get-messages/${encoded}?count=${count}&direction=before`
        )), chatId);
        diagnostic("API", "HISTORY_GET_MESSAGES", { count: items.length });
      } catch (error) {
        getError = error;
        diagnostic("API", "HISTORY_GET_FAILED", { kind: errorKind(error) });
      }

      // Newer WhatsApp accounts may store the same contact as @lid while
      // manual number entry uses @c.us. Only use the WPPConnect's official
      // PN/LID mapping; never manufacture or guess an identity.
      let historyEncoded = encoded;
      if (!items.length && getError && chatId.endsWith("@c.us")) {
        try {
          const mapping = await callWpp(sessionPath(`contact/pn-lid/${encoded}`));
          const detail = mapping?.response ?? mapping?.data ?? mapping;
          let mappedId = asId(detail?.lid) || asId(detail?.lidId) ||
            asId(detail?.pnLid?.lid);
          if (/^[0-9]{7,30}$/.test(mappedId)) mappedId += "@lid";
          if (/^[0-9]{7,30}@lid$/.test(mappedId)) {
            historyEncoded = encodeURIComponent(mappedId);
            try {
              items = normalizeMessageList(await callWpp(sessionPath(
                `get-messages/${historyEncoded}?count=${count}&direction=before`
              )), chatId);
              getError = null;
              source = "GET_MESSAGES_PNLID";
              diagnostic("API", "HISTORY_PNLID_RECOVERED", { count: items.length });
            } catch (retryError) {
              diagnostic("API", "HISTORY_PNLID_RETRY_FAILED", { kind: errorKind(retryError) });
            }
          } else {
            diagnostic("API", "HISTORY_PNLID_UNAVAILABLE", {});
          }
        } catch (mappingError) {
          diagnostic("API", "HISTORY_PNLID_LOOKUP_FAILED", { kind: errorKind(mappingError) });
        }
      }

      if (!items.length) {
        try {
          const older = normalizeMessageList(await callWpp(sessionPath(
            `all-messages-in-chat/${historyEncoded}?${chatId.endsWith("@g.us") ? "isGroup=true&" : ""}includeMe=true&includeNotifications=false`
          )), chatId);
          if (older.length || !getError) {
            items = older;
            source = "ALL_MESSAGES";
          }
          diagnostic("API", "HISTORY_LEGACY_MESSAGES", { count: older.length });
          if (getError && !older.length) {
            diagnostic("API", "HISTORY_EMPTY_AFTER_ERROR", {});
            const failed = new Error("O WhatsApp não conseguiu abrir este histórico. Tente novamente.");
            failed.statusCode = 502;
            throw failed;
          }
        } catch (error) {
          diagnostic("API", "HISTORY_LEGACY_FAILED", { kind: errorKind(error) });
          if (getError) {
            diagnostic("API", "HISTORY_BOTH_FAILED", {});
            const failed = new Error("Não foi possível carregar o histórico do WhatsApp. Tente novamente.");
            failed.statusCode = 502;
            throw failed;
          }
          if (!items.length) {
            const failed = new Error("Não foi possível carregar o histórico do WhatsApp. Tente novamente.");
            failed.statusCode = 502;
            throw failed;
          }
        }
      }
      const result = items.slice(-count);
      diagnostic("API", "MESSAGES_LOADED", { count: result.length, source });
      return json(res, 200, result);
    }

    if (req.method === "POST" && pathname === "/attachments") {
      const body = await readBody(req, 13_000_000);
      const { chatId, base64, filename, caption = "" } = body;
      if (typeof chatId !== "string" || !/^[a-zA-Z0-9_.-]+@(c\.us|g\.us|lid)$/.test(chatId) ||
          typeof base64 !== "string" || base64.length > 11_500_000 ||
          !/^data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(base64) ||
          typeof filename !== "string" || !filename || filename.length > 120 ||
          typeof caption !== "string" || caption.length > 1024) {
        return json(res, 400, { error: "Arquivo inválido ou acima do limite de 8 MB." });
      }
      const bytes = Buffer.from(base64.split(",")[1], "base64").length;
      if (!bytes || bytes > 8 * 1024 * 1024) return json(res, 413, { error: "Máximo de 8 MB por arquivo." });
      await callWpp(sessionPath("send-file-base64"), { method: "POST",
        body: { phone: [chatId], isGroup: chatId.endsWith("@g.us"), base64,
          filename: filename.replace(/[\/\\]/g, "_"), caption },
        timeoutMs: 90_000 });
      diagnostic("API", "ATTACHMENT_SENT", { sizeBytes: bytes });
      return json(res, 200, { ok: true });
    }

    const mediaMatch = pathname.match(/^\/media\/([^/]+)$/);
    if (mediaMatch && req.method === "GET") {
      const messageId = decodeURIComponent(mediaMatch[1]);
      if (messageId.length > 250) return json(res, 400, { error: "Identificador inválido." });
      // GET get-media-by-message evita falhas comuns de download-media
      // quando messageId chega como string. WPPConnect 2.10.61 possui ambas.
      let raw;
      let mediaSource = "GET_MEDIA";
      try {
        raw = await callWpp(sessionPath(`get-media-by-message/${encodeURIComponent(messageId)}`), { timeoutMs: 90_000 });
      } catch (error) {
        diagnostic("API", "MEDIA_GET_FAILED", { kind: errorKind(error) });
        raw = await callWpp(sessionPath("download-media"), {
          method: "POST", body: { messageId }, timeoutMs: 90_000,
        });
        mediaSource = "DOWNLOAD_MEDIA";
      }
      let normalized = normalizeMediaPayload(raw);
      if (!normalized.base64) {
        diagnostic("API", "MEDIA_BAD_RESPONSE",
          { source: mediaSource, reason: normalized.reason });
        if (mediaSource === "GET_MEDIA") {
          try {
            const retry = await callWpp(sessionPath("download-media"), {
              method: "POST", body: { messageId }, timeoutMs: 90_000,
            });
            normalized = normalizeMediaPayload(retry);
            mediaSource = "DOWNLOAD_MEDIA";
          } catch (error) {
            diagnostic("API", "MEDIA_FALLBACK_FAILED", { kind: errorKind(error) });
          }
        }
      }
      if (!normalized.base64) {
        diagnostic("API", "MEDIA_UNAVAILABLE",
          { source: mediaSource, reason: normalized.reason });
        return json(res, 502, {
          error: "Este áudio ou arquivo não pôde ser recuperado do WhatsApp. Tente novamente mais tarde.",
        });
      }
      diagnostic("API", "MEDIA_LOADED",
        { source: mediaSource, bytes: normalized.bytes });
      return json(res, 200, { base64: normalized.base64, mimetype: normalized.mimetype });
    }

    if (match && req.method === "POST") {
      const chatId = decodeURIComponent(match[1]);
      const body = await readBody(req);
      const messageText = typeof body.body === "string" ? body.body.trim() : "";
      if (!messageText) return json(res, 400, { error: "Digite uma mensagem antes de enviar." });
      const isGroup = chatId.endsWith("@g.us");
      const isLid = chatId.endsWith("@lid");
      const phone = chatId; // preserve @c.us/@g.us/@lid identifiers returned by WPPConnect
      await callWpp(sessionPath("send-message"), {
        method: "POST",
        body: { phone: [phone], isGroup, isNewsletter: false, isLid, message: messageText },
      });
      // NAO inventar um ID de mensagem local: ao sincronizar, WPPConnect
      // devolve a mesma mensagem com o ID real, gerando duplicatas no React.
      previewCache.delete(chatId);
      previewAttempted.delete(chatId);
      diagnostic("API", "TEXT_SENT", { successful: true });
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "Rota não encontrada." });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    const message = error?.message || "Erro inesperado no adaptador local.";
    if (status >= 500) console.error("[Ideal Zap]", message);
    return json(res, status, { error: message, ...(error?.details ? { details: error.details } : {}) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  diagnostic("API", "SERVER_LISTENING", { port: PORT, qrBridgeConfigured: Boolean(QR_BRIDGE_URL) });
  console.log(`[Ideal Zap] Adaptador local em http://127.0.0.1:${PORT}`);
  console.log(`[Ideal Zap] Diagnostico local em: ${LOG_FILE}`);
  console.log(`[Ideal Zap] WPPConnect: ${WPP_BASE_URL}`);
  if (!WPP_SESSION || !WPP_TOKEN) {
    console.warn("[Ideal Zap] Configure WPP_SESSION e WPP_TOKEN em backend/.env");
  }
});
