import { test } from "node:test";
import assert from "node:assert/strict";
import { phoneFromPnLidEntry, collapseMappedContacts } from "./contact-identity.mjs";

const lid = "987654321098765@lid";
const phone = "5565999999999@c.us";
const chats = [
  { id: lid, contact: { name: "Nome A" } },
  { id: phone, contact: { name: "Nome B" } },
  { id: "111111111111111@lid", contact: { name: "Nome B" } },
];

test("official PN/LID endpoint resolves phone JID with nested entry", () => {
  assert.equal(phoneFromPnLidEntry({ response: { lid, pn: phone } }, lid), phone);
  assert.equal(phoneFromPnLidEntry({ data: { entry: { lid, pn: "5565999999999" } } }, lid), phone);
  assert.equal(phoneFromPnLidEntry({ response: { lid: "222222222222222@lid", pn: phone } }, lid), "");
  assert.equal(phoneFromPnLidEntry({ response: { pn: "bad-identifier" } }, lid), "");
});

test("removes only contacts proven by official map and preserves ambiguous names", async () => {
  const result = await collapseMappedContacts(chats, async (id) => id === lid ? phone : "", {
    maxLookups: 10, concurrency: 2,
  });
  assert.deepEqual(result.contacts.map((x) => x.id), [phone, "111111111111111@lid"]);
  assert.equal(result.mappedPairs, 1);
});

test("official WA-JS returns phoneNumber Wid, not the legacy pn field", () => {
  const entry = { response: {
    lid: { id: "987654321098765", server: "lid", _serialized: lid },
    phoneNumber: { id: "5565999999999", server: "c.us", _serialized: phone },
  } };
  assert.equal(phoneFromPnLidEntry(entry, lid), phone);
});

test("deduplication retains cached verified IDs while checking new ones", async () => {
  const extraLid = "333333333333333@lid";
  const pair = [...chats, { id: extraLid, contact: { name: "Outro" } }];
  const first = await collapseMappedContacts(pair, async (id) => id === lid ? phone : "",
    { maxLookups: 1, isCached: (id) => id === lid });
  assert(!first.contacts.some((x) => x.id === lid));
  assert.equal(first.contacts.length, 3);
});

test("lookup failures do not accidentally merge people with the same name", async () => {
  const result = await collapseMappedContacts(chats, async () => {
    throw Error("WPP disconnected");
  });
  assert.equal(result.contacts.length, 3);
});
