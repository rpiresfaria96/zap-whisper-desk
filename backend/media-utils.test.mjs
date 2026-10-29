import { test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeMediaPayload } from "./media-utils.mjs";

test("normalizes WhatsApp voice notes with codecs parameter", () => {
  const base64 = Buffer.from("OggS-voice-test").toString("base64");
  const result = normalizeMediaPayload({ base64, mimetype: "audio/ogg; codecs=opus" });
  assert.equal(result.mimetype, "audio/ogg");
  assert.equal(result.base64, base64);
});

test("unwraps response and data URI", () => {
  const base64 = Buffer.from("%PDF-test-contents").toString("base64");
  const result = normalizeMediaPayload({ response: {
    base64: `data:application/pdf;base64,${base64}` } });
  assert.equal(result.mimetype, "application/pdf");
});

test("accepts JSON Buffer representation and normalizes base64 whitespace", () => {
  const bytes = Buffer.from("OggS-test-voice");
  assert.equal(normalizeMediaPayload({
    data: { type: "Buffer", data: [...bytes] }, mimetype: "audio/ogg; codecs=opus",
  }).mimetype, "audio/ogg");
  const value = bytes.toString("base64").replace(/(.{5})/g, "$1\n");
  assert.equal(normalizeMediaPayload({ base64: value, mimetype: "audio/ogg" }).mimetype, "audio/ogg");
});

test("rejects invalid MIME and malformed bytes", () => {
  assert.equal(normalizeMediaPayload({ base64: "SGVsbG8hISE=", mimetype: "text/html" }).reason, "UNKNOWN_MIME");
  assert.equal(normalizeMediaPayload({ base64: "not-a-base64!!", mimetype: "audio/ogg" }).reason, "BAD_BASE64");
});
