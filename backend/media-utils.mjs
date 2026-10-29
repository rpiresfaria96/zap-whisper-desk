// Normaliza respostas da API WPPConnect sem gravar bytes, mensagens ou MIME no log.
const MAX_B64 = 16_000_000;
const safeMime = /^(?:image|audio|video)\/[a-z0-9.+-]+$|^application\/[a-z0-9.+-]+$|^text\/(?:plain|csv)$/;
export function normalizeMediaPayload(payload) {
  let media = payload;
  for (let i = 0; i < 3 && media && typeof media === "object"; i++) {
    if (media.base64 || typeof media.data === "string" || media.data?.type === "Buffer") break;
    media = media.response || media.data || media;
    if (media === payload && i > 0) break;
  }
  if (!media || typeof media !== "object") return { reason: "NO_OBJECT" };
  let mime = String(media.mimetype || media.mimeType || media.contentType || "").trim()
    .toLowerCase().split(";")[0].trim();
  let input = media.base64 ?? media.data ?? media.content ?? "";
  if (input && typeof input === "object" && input.type === "Buffer" && Array.isArray(input.data)) {
    if (input.data.length < 1 || input.data.length > 12_000_000) return { reason: "BAD_BUFFER_SIZE" };
    const bytes = Buffer.from(input.data);
    input = bytes.toString("base64");
  }
  if (typeof input !== "string") return { reason: "NO_STRING" };
  if (input.startsWith("data:")) {
    const comma = input.indexOf(",");
    if (comma < 0 || comma > 180 || !/;base64$/i.test(input.slice(0, comma))) {
      return { reason: "BAD_DATA_URI" };
    }
    if (!mime) mime = input.slice(5, comma).split(";")[0].toLowerCase();
    input = input.slice(comma + 1);
  }
  // Áudios do WhatsApp normalmente chegam como "audio/ogg; codecs=opus".
  const encoded = input.replace(/[\r\n\t ]+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (encoded.length < 8 || encoded.length > MAX_B64 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    return { reason: "BAD_BASE64" };
  }
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > 12_000_000) return { reason: "BAD_DECODED_SIZE" };
  if (!mime || mime === "application/octet-stream") {
    if (bytes.subarray(0, 4).toString("ascii") === "OggS") mime = "audio/ogg";
    else if (bytes.subarray(0, 3).toString("ascii") === "ID3") mime = "audio/mpeg";
    else if (bytes.subarray(0, 4).toString("ascii") === "%PDF") mime = "application/pdf";
    else if (bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
             bytes.subarray(8, 12).toString("ascii") === "WAVE") mime = "audio/wav";
    else if (bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
             bytes.subarray(8, 12).toString("ascii") === "WEBP") mime = "image/webp";
    else if (bytes.subarray(0, 4).toString("ascii") === "\x89PNG") mime = "image/png";
    else if (bytes[0] === 0xff && bytes[1] === 0xd8) mime = "image/jpeg";
    else if (bytes.subarray(4, 8).toString("ascii") === "ftyp") mime = "audio/mp4";
  }
  if (!safeMime.test(mime)) return { reason: "UNKNOWN_MIME" };
  return { base64: bytes.toString("base64"), mimetype: mime, bytes: bytes.length };
}
