import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { installPhoneActions } from '../scripts/install-phone-actions.mjs';

const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const load = (source) => import('data:text/javascript;base64,' + Buffer.from(transpile(source)).toString('base64'));
const controller = await load(readFileSync(new URL('../scripts/phone-actions.ts', import.meta.url), 'utf8'));
function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}
function request(body) { return { body, client: { page: { evaluate: (fn, args) => fn(args) } } }; }

test('saving requests phone address book sync and does not accept missing confirmation', async () => {
  let received;
  globalThis.WPP = { contact: { save: async (...args) => { received = args; return { isMyContact: true }; } } };
  const res = response();
  await controller.savePhoneContact(request({ phone: '5565999999999@c.us', name: 'Contato' }), res);
  assert.equal(res.code, 200);
  assert.equal(received[2].syncAddressBook, true);
  globalThis.WPP.contact.save = async () => undefined;
  const failed = response();
  await controller.savePhoneContact(request({ phone: '5565999999999@c.us', name: 'Contato' }), failed);
  assert.equal(failed.code, 409);
});

test('delete uses real LID chat, retains media, and checks revoked state', async () => {
  let deleted = false;
  globalThis.WPP = { chat: {
    getMessageById: async () => ({ senderObj: { isMe: true }, id: { remote: '123456789012345@lid' }, type: deleted ? 'revoked' : 'chat' }),
    deleteMessage: async (...args) => {
      assert.deepEqual(args, ['123456789012345@lid', 'true_123456789012345@lid_ABC', false, true]);
      deleted = true; return { isRevoked: true };
    },
  } };
  const res = response();
  await controller.deleteCheckedMessage(request({ messageId: 'true_123456789012345@lid_ABC', onlyLocal: false }), res);
  assert.equal(res.body.response.confirmed, true);
});

test('revocation accepted without local placeholder is pending, never confirmed', async () => {
  globalThis.WPP = { chat: {
    getMessageById: async () => ({
      senderObj: { isMe: true }, id: { remote: '123456789012345@lid' },
      type: 'chat',
    }),
    deleteMessage: async () => ({ isRevoked: true, isSentByMe: true }),
  } };
  const res = response();
  await controller.deleteCheckedMessage(request({
    messageId: 'true_123456789012345@lid_ABC', onlyLocal: false,
  }), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.response.submitted, true);
  assert.equal(res.body.response.confirmed, false);
});

test('revocation rejected by WA-JS is a failure, not a UI deletion', async () => {
  globalThis.WPP = { chat: {
    getMessageById: async () => ({
      senderObj: { isMe: true }, id: { remote: '123456789012345@lid' },
      type: 'chat',
    }),
    deleteMessage: async () => ({ isRevoked: false }),
  } };
  const res = response();
  await controller.deleteCheckedMessage(request({
    messageId: 'true_123456789012345@lid_ABC', onlyLocal: false,
  }), res);
  assert.equal(res.code, 409);
  assert.equal(res.body.reason, 'not_accepted');
});

test('delete refuses foreign messages without deleting locally', async () => {
  globalThis.WPP = { chat: { getMessageById: async () => ({ senderObj: { isMe: false } }),
    deleteMessage: async () => { throw Error('must not call'); } } };
  const res = response();
  await controller.deleteCheckedMessage(request({ messageId: 'false_123456789@c.us_ABC', onlyLocal: false }), res);
  assert.equal(res.code, 409);
});

test('installer is repeatable; forwarding accepts empty failure list only', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ideal-zap-test-'));
  mkdirSync(join(root, 'wppconnect-server/src/controller'), { recursive: true });
  mkdirSync(join(root, 'wppconnect-server/src/routes'), { recursive: true });
  mkdirSync(join(root, 'scripts'));
  writeFileSync(join(root, 'scripts/phone-actions.ts'), 'export {};');
  const path = join(root, 'wppconnect-server/src/controller/deviceController.ts');
  writeFileSync(path, 'const contactToArray = (phone) => [phone];\nexport async function forwardMessages() {}\nexport async function markUnseenMessage() {}');
  const route = join(root, 'wppconnect-server/src/routes/index.ts');
  writeFileSync(route, 'const routes: Router = Router();');
  installPhoneActions(root);
  const first = readFileSync(path, 'utf8');
  installPhoneActions(root);
  assert.equal(readFileSync(path, 'utf8'), first);
  assert.equal(readFileSync(route, 'utf8').match(/ideal-save-contact/g).length, 1);
  const { forwardMessages } = await load(first);
  for (const [failures, expected] of [[[], 201], [['failed-id'], 409], [null, 409], [false, 409]]) {
    const res = response();
    await forwardMessages({ body: { phone: '123@lid', messageId: 'id' }, client: {
      forwardMessagesV2: async (peer, ids) => { assert.equal(peer, '123@lid'); assert.deepEqual(ids, ['id']); return failures; },
    } }, res);
    assert.equal(res.code, expected);
  }
});
