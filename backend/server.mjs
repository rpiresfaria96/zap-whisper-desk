import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv(join(here, ".env"));

const PORT = Number(process.env.API_PORT || 3001);
const WPP_BASE_URL = (process.env.WPP_BASE_URL || "http://127.0.0.1:8788").replace(/\/+$/, "");
const WPP_SESSION = process.env.WPP_SESSION || "";
const WPP_TOKEN = process.env.WPP_TOKEN || "";
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000")
  .split(",").map((s) => s.trim()).filter(Boolean);

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
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let payload = text;
  try { payload = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) {
    const err = new Error(`WPPConnect respondeu HTTP ${response.status}. Confira a sessão, o token e a versão da API.`);
    err.statusCode = response.status === 401 || response.status === 403 ? 502 : response.status;
    err.details = typeof payload === "string" ? payload.slice(0, 300) : undefined;
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

function bodyText(raw) {
  const body = raw?.body ?? raw?.caption ?? raw?.text ?? raw?.content ?? raw?.description;
  if (typeof body === "string") return body;
  if (typeof body === "number") return String(body);
  const type = String(raw?.type || raw?.mimetype || "").toLowerCase();
  if (type.includes("image")) return "[Imagem]";
  if (type.includes("video")) return "[Vídeo]";
  if (type.includes("audio") || type.includes("ptt")) return "[Áudio]";
  if (type.includes("document") || type.includes("file")) return "[Arquivo]";
  if (type.includes("sticker")) return "[Figurinha]";
  return "";
}

function normalizeMessage(raw, chatId) {
  const id = asId(raw?.id) || asId(raw?.messageId) || asId(raw?.key?.id) || `msg-${chatId}-${epochMs(raw?.timestamp ?? raw?.t)}`;
  const timestamp = epochMs(raw?.timestamp ?? raw?.t ?? raw?.time ?? raw?.createdAt);
  const ack = Number(raw?.ack ?? raw?.ackStatus);
  let status = raw?.status;
  if (!["sending", "sent", "delivered", "read"].includes(status)) {
    status = ack >= 3 ? "read" : ack >= 2 ? "delivered" : "sent";
  }
  return {
    id,
    chatId,
    fromMe: Boolean(raw?.fromMe ?? raw?.id?.fromMe ?? raw?.key?.fromMe),
    body: bodyText(raw),
    timestamp,
    status: Boolean(raw?.fromMe ?? raw?.id?.fromMe ?? raw?.key?.fromMe) ? status : undefined,
  };
}

function displayPhone(chatId, isGroup) {
  if (isGroup) return "Grupo";
  const digits = chatId.split("@")[0].replace(/\D/g, "");
  return digits ? `+${digits}` : chatId;
}

function normalizeChat(raw) {
  const id = asId(raw?.chatId) || asId(raw?.id) || asId(raw?.contact?.id) || asId(raw?.lastMessage?.chatId) || asId(raw?.conversationId);
  if (!id) return null;
  const isGroup = Boolean(raw?.isGroup) || id.endsWith("@g.us");
  const contact = raw?.contact || {};
  const phone = displayPhone(id, isGroup);
  const name = asText(raw?.name) || asText(raw?.formattedTitle) || asText(raw?.pushname) ||
    asText(contact?.name) || asText(contact?.pushname) || asText(contact?.formattedName) ||
    (isGroup ? "Grupo do WhatsApp" : phone);
  const last = raw?.lastMessage || raw?.lastMessageObj || raw?.last_message;
  const avatarUrl = asText(raw?.profilePicUrl) || asText(raw?.profilePicThumbObj?.eurl) ||
    asText(contact?.profilePicThumbObj?.eurl) || asText(contact?.profilePicUrl) || undefined;
  const unread = Number(raw?.unreadCount ?? raw?.unreadMessages ?? raw?.unreadMessageCount ?? 0);
  return {
    id,
    contact: { id, name, phone, ...(avatarUrl ? { avatarUrl } : {}), ...(isGroup ? { about: "Grupo" } : {}) },
    lastMessage: last && typeof last === "object" ? normalizeMessage(last, id) : undefined,
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

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) {
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

const eventClients = new Set();
const seenEvents = new Set();
let pollingEvents = false;

async function pollNewMessages() {
  if (!eventClients.size || pollingEvents || !WPP_SESSION || !WPP_TOKEN) return;
  pollingEvents = true;
  try {
    const payload = await callWpp(sessionPath("all-new-messages"));
    for (const raw of sourceArray(payload)) {
      const chatId = rawMessageChatId(raw);
      if (!chatId) continue;
      const message = normalizeMessage(raw, chatId);
      if (!message.body && !raw?.type) continue;
      if (seenEvents.has(message.id)) continue;
      seenEvents.add(message.id);
      if (seenEvents.size > 1500) seenEvents.delete(seenEvents.values().next().value);
      const packet = `data: ${JSON.stringify(message)}\n\n`;
      for (const client of eventClients) {
        try { client.write(packet); } catch {}
      }
    }
  } catch (error) {
    console.error("[Ideal Zap] Falha ao buscar novas mensagens:", error.message);
  } finally {
    pollingEvents = false;
  }
}
setInterval(pollNewMessages, 5000).unref();

const server = createServer(async (req, res) => {
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
        configured: Boolean(WPP_SESSION && WPP_TOKEN),
        wppBaseUrl: WPP_BASE_URL,
        session: WPP_SESSION || null,
        tokenConfigured: Boolean(WPP_TOKEN),
      });
    }

    if (req.method === "GET" && pathname === "/status") {
      const status = await callWpp(sessionPath("status-session"));
      return json(res, 200, status);
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

    if (req.method === "GET" && pathname === "/chats") {
      let payload;
      try {
        payload = await callWpp(sessionPath("all-chats"));
      } catch (error) {
        if (error.statusCode !== 404) throw error;
        payload = await callWpp(sessionPath("list-chats"), { method: "POST", body: {} });
      }
      const chats = sourceArray(payload).map(normalizeChat).filter(Boolean);
      return json(res, 200, chats);
    }

    const match = pathname.match(/^\/chats\/([^/]+)\/messages$/);
    if (match && req.method === "GET") {
      const chatId = decodeURIComponent(match[1]);
      const count = Math.max(1, Math.min(100, Number(url.searchParams.get("count") || 100)));
      const endpoint = sessionPath(`get-messages/${encodeURIComponent(chatId)}?count=${count}&direction=before`);
      const payload = await callWpp(endpoint);
      return json(res, 200, normalizeMessageList(payload, chatId));
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
      return json(res, 200, {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        chatId,
        fromMe: true,
        body: messageText,
        timestamp: Date.now(),
        status: "sent",
      });
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
  console.log(`[Ideal Zap] Adaptador local em http://127.0.0.1:${PORT}`);
  console.log(`[Ideal Zap] WPPConnect: ${WPP_BASE_URL}`);
  if (!WPP_SESSION || !WPP_TOKEN) {
    console.warn("[Ideal Zap] Configure WPP_SESSION e WPP_TOKEN em backend/.env");
  }
});
