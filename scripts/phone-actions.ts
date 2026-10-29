// Installed into the local WPPConnect controller by INICIAR.bat.
import type { Request, Response } from 'express';

export async function deleteCheckedMessage(req: Request, res: Response) {
  const { messageId, onlyLocal } = req.body;
  if (typeof messageId !== 'string' || !/^[A-Za-z0-9_@.:-]{1,250}$/.test(messageId) ||
      typeof onlyLocal !== 'boolean') return res.status(400).json({ status: 'error' });
  try {
    const result = await req.client.page.evaluate(async ({ messageId, onlyLocal }) => {
      const wa = (globalThis as any).WPP;
      const msg = await wa.chat.getMessageById(messageId);
      if (!msg) return { state: 'message_not_found' };
      // Some WhatsApp versions omit senderObj on hydrated messages.
      const fromMe = msg.senderObj?.isMe === true || msg.id?.fromMe === true || msg.fromMe === true;
      if (!onlyLocal && !fromMe) return { state: 'not_author' };
      const remote = msg.id?.remote?.toString?.();
      if (!remote) return { state: 'missing_remote' };
      // WA-JS returns isRevoked when the native revoke command is accepted.
      // That DOES NOT guarantee that the recipient has received the revoke.
      const response = await wa.chat.deleteMessage(remote, messageId, false, !onlyLocal);
      const outcome = Array.isArray(response) ? response[0] : response;
      if (onlyLocal) {
        return { state: outcome?.isDeleted === true ? 'confirmed' : 'not_confirmed' };
      }
      if (outcome?.isRevoked !== true || outcome?.isSentByMe === false) {
        return { state: 'not_accepted' };
      }
      // Wait briefly for the local message to turn into a revoke placeholder.
      // Keep pending when the command was accepted but the store is delayed.
      for (let attempt = 0; attempt < 16; attempt++) {
        try {
          const current = await wa.chat.getMessageById(messageId);
          if (current?.type === 'revoked' || current?.isRevoked === true)
            return { state: 'confirmed' };
        } catch {
          // The local message may temporarily disappear during reconciliation.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return { state: 'submitted' };
    }, { messageId, onlyLocal });
    if (result?.state === 'confirmed') {
      return res.json({ status: 'success', response: { confirmed: true } });
    }
    if (!onlyLocal && result?.state === 'submitted') {
      return res.json({ status: 'success', response: { submitted: true, confirmed: false } });
    }
    return res.status(409).json({ status: 'error', reason: result?.state || 'unknown' });
  } catch {
    return res.status(502).json({ status: 'error', reason: 'evaluation_failed' });
  }
}

export async function savePhoneContact(req: Request, res: Response) {
  const { phone, name } = req.body;
  if (typeof phone !== 'string' || !/^[0-9]{7,15}@c\.us$/.test(phone) ||
      typeof name !== 'string' || !name.trim() || name.length > 100) {
    return res.status(400).json({ status: 'error', message: 'Invalid contact' });
  }
  try {
    const saved = await req.client.page.evaluate(async ({ phone, name }) => {
      const wa = (globalThis as any).WPP;
      if (typeof wa?.contact?.save !== 'function') return false;
      const contact = await wa.contact.save(phone, name, { syncAddressBook: true });
      return Boolean(contact?.isMyContact);
    }, { phone, name: name.trim() });
    if (!saved) return res.status(409).json({ status: 'error', message: 'Contact not confirmed' });
    return res.json({ status: 'success', response: { saved: true, syncRequested: true } });
  } catch {
    return res.status(502).json({ status: 'error', message: 'Phone contact save failed' });
  }
}
