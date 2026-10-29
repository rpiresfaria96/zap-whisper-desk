// Ideal-Zap: HTTPS publico SOMENTE na rede local, na porta original 8080.
// Vite roda internamente em http://127.0.0.1:8081; a API permanece
// em http://127.0.0.1:3001 e nunca e exposta diretamente.
// As chaves TLS ficam somente em .local/https (ignorado pelo Git).
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const certDir = join(root, '.local', 'https');
const pfx = join(certDir, 'idealzap-lan.pfx');
const password = join(certDir, 'pfx.pass');
const privateKey = join(certDir, 'key.pem');
const pemCert = join(certDir, 'cert.pem');
const hasPfx = existsSync(pfx) && existsSync(password);
const hasPem = existsSync(privateKey) && existsSync(pemCert);
if (!hasPfx && !hasPem) {
  console.error('[Ideal-Zap HTTPS] Certificado nao encontrado. Execute CRIAR_CERTIFICADO_8080.bat.');
  process.exit(1);
}
const tls = hasPfx
  ? { pfx: readFileSync(pfx), passphrase: readFileSync(password, 'utf8').trim() }
  : { key: readFileSync(privateKey), cert: readFileSync(pemCert) };
// Self-tests may use alternate loopback ports only when explicitly enabled.
// Normal Windows startup ALWAYS uses public 8080 and internal 8081.
const testPorts = process.env.IDEAL_ZAP_GATEWAY_SELFTEST === '1';
const port = testPorts ? Number(process.env.IDEAL_ZAP_SELFTEST_HTTPS_PORT || 18080) : 8080;
const internalPort = testPorts ? Number(process.env.IDEAL_ZAP_SELFTEST_UI_PORT || 18081) : 8081;

function forwardedHeaders(request) {
  const originalHost = request.headers.host;
  const headers = { ...request.headers, host: `127.0.0.1:${internalPort}` };
  // So converta Origin quando a solicitacao veio do proprio site HTTPS.
  // Solicitações de outro site ficam intactas para o backend rejeitar CSRF.
  if (typeof originalHost === 'string' &&
      (headers.origin === `https://${originalHost}`)) {
    headers.origin = 'http://127.0.0.1:8080';
  }
  // O backend conhece somente o host interno. Nunca aceitar destino
  // arbitrario em cabecalhos do cliente, nem encaminhar autenticacao extra.
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-proto'];
  return headers;
}

const server = createServer(tls, (request, response) => {
  const upstream = httpRequest({
    hostname: '127.0.0.1', port: internalPort,
    method: request.method, path: request.url,
    headers: forwardedHeaders(request),
  }, (result) => {
    response.writeHead(result.statusCode || 502, result.headers);
    result.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('A interface interna do Ideal-Zap nao respondeu.');
  });
  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
});

// HMR/WebSocket: manter o mesmo endereco wss://IP:8080/ para o navegador.
server.on('upgrade', (request, client, clientHead) => {
  const upstream = httpRequest({
    hostname: '127.0.0.1', port: internalPort,
    method: request.method, path: request.url,
    headers: forwardedHeaders(request),
  });
  upstream.on('upgrade', (res, socket, serverHead) => {
    const lines = [];
    for (let i = 0; i < res.rawHeaders.length; i += 2)
      lines.push(`${res.rawHeaders[i]}: ${res.rawHeaders[i + 1]}`);
    client.write(`HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n${lines.join('\r\n')}\r\n\r\n`);
    if (clientHead.length) socket.write(clientHead);
    if (serverHead.length) client.write(serverHead);
    client.on('error', () => socket.destroy());
    socket.on('error', () => client.destroy());
    client.pipe(socket).pipe(client);
  });
  upstream.on('response', (res) => {
    client.end(`HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\nConnection: close\r\n\r\n`);
  });
  upstream.on('error', () => client.destroy());
  upstream.end();
});
server.on('error', (error) => {
  console.error('[Ideal-Zap HTTPS] Falha na porta 8080:', error.code || 'ERRO');
  process.exitCode = 1;
});
server.listen(port, '0.0.0.0', () => {
  console.log('[Ideal-Zap HTTPS] Ativo em https://IP_DO_SERVIDOR:8080/');
});
