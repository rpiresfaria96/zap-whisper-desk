// Only collapse LID and phone contacts when an official PN/LID mapping
// points to an existing phone entry. A matching display name is not identity.
function jid(input) {
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return "";
  if (typeof input._serialized === "string") return input._serialized;
  if (typeof input.user === "string" && typeof input.server === "string")
    return input.user + "@" + input.server;
  return "";
}

export function phoneFromPnLidEntry(input, lidId) {
  const payload = input?.response ?? input?.data ?? input;
  const entry = payload?.entry ?? payload?.pnLid ?? payload;
  if (!entry || typeof entry !== "object") return "";
  const lid = jid(entry.lid ?? entry.lidId ?? entry.lidWid);
  if (lid && lid !== lidId) return "";
  let phone = jid(entry.phoneNumber ?? entry.pn ?? entry.phoneWid ?? entry.phoneId);
  if (/^[0-9]{7,15}$/.test(phone)) phone += "@c.us";
  return /^[0-9]{7,15}@c\.us$/.test(phone) ? phone : "";
}

export async function collapseMappedContacts(chats, resolvePhone, { maxLookups = 90, concurrency = 5, isCached = null } = {}) {
  const byId = new Map(chats.map((chat) => [chat.id, chat]));
  const lids = chats.filter((chat) => chat.id.endsWith("@lid"));
  const saved = isCached ? lids.filter((item) => isCached(item.id)) : [];
  const fresh = isCached ? lids.filter((item) => !isCached(item.id)) : lids;
  // Reuse every previously verified mapping, then check a bounded
  // number of new aliases. Otherwise old duplicates reappear after refresh.
  const batch = [...saved, ...fresh.slice(0, maxLookups)];
  const discard = new Set();
  let next = 0;
  async function worker() {
    while (next < batch.length) {
      const item = batch[next++];
      try {
        const officialPhone = await resolvePhone(item.id);
        if (byId.has(officialPhone)) discard.add(item.id);
      } catch {
        // Missing mapping is not evidence that two contacts are identical.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker));
  return { contacts: chats.filter((item) => !discard.has(item.id)),
    mappedPairs: discard.size, lookedUp: batch.length,
    unresolvedLids: Math.max(0, fresh.length - maxLookups) };
}
