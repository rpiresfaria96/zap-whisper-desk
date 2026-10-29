import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs after legacy compatibility patches; leaves their unrelated fixes intact.
export function installPhoneActions(root) {
  const target = join(root, 'wppconnect-server/src');
  const controllerPath = join(target, 'controller/deviceController.ts');
  let source = readFileSync(controllerPath, 'utf8');
  const start = source.indexOf('export async function forwardMessages(');
  const end = source.indexOf('export async function markUnseenMessage(', start);
  if (start < 0 || end < 0) throw new Error('Unsupported forward controller');
  const forward = `export async function forwardMessages(req: Request, res: Response) {
  const { phone, messageId, isGroup = false } = req.body;
  try {
    const contacts = contactToArray(phone, isGroup);
    if (!contacts.length) return res.status(400).json({ status: 'error' });
    for (const contact of contacts) {
      // WA-JS returns failures, not sent IDs. Never retry an ambiguous timeout.
      const failures = await req.client.forwardMessagesV2(contact, [messageId],
        { displayCaptionText: true });
      if (!Array.isArray(failures) || failures.length !== 0) {
        return res.status(409).json({ status: 'error', message: 'Native forwarding failed' });
      }
    }
    return res.status(201).json({ status: 'success', response: { forwarded: true } });
  } catch {
    return res.status(502).json({ status: 'error', message: 'Forwarding not confirmed' });
  }
}

`;
  source = source.slice(0, start) + forward + source.slice(end);
  writeFileSync(controllerPath, source);
  copyFileSync(join(root, 'scripts/phone-actions.ts'), join(target, 'controller/idealPhoneActions.ts'));
  const routesPath = join(target, 'routes/index.ts');
  let routes = readFileSync(routesPath, 'utf8');
  if (!routes.includes("from '../controller/idealPhoneActions'")) {
    routes = "import { savePhoneContact, deleteCheckedMessage } from '../controller/idealPhoneActions';\n" + routes;
    routes = routes.replace('const routes: Router = Router();', `const routes: Router = Router();
routes.post('/api/:session/ideal-save-contact', verifyToken, statusConnection, savePhoneContact);
routes.post('/api/:session/ideal-delete-message', verifyToken, statusConnection, deleteCheckedMessage);`);
  }
  writeFileSync(routesPath, routes);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  installPhoneActions(dirname(dirname(fileURLToPath(import.meta.url))));
  console.log('Operações de contato, encaminhamento e exclusão atualizadas.');
}
