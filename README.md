# Ideal Zap — ambiente local integrado

Este repositório reúne a interface do Ideal Zap, o adaptador HTTP local para WPPConnect Server e scripts que baixam o WPPConnect oficial dentro desta mesma pasta. O WPPConnect fica em uma subpasta local e não mistura seus arquivos com o código principal.

## Preparação em uma pasta

1. Baixe este repositório em **Code → Download ZIP** e extraia-o para uma pasta de trabalho.
2. Execute **PREPARAR_AMBIENTE.bat**.
3. O preparador baixa um Node.js portátil v22.22.2, verifica o SHA-256, baixa o WPPConnect Server oficial v2.10.61, adiciona o Manager oficial e instala as dependências. Não precisa instalar o Node globalmente.
4. Execute **INICIAR_TUDO.bat**.
5. A interface abre em http://127.0.0.1:8080/. Não precisa entrar no Manager, cadastrar senha ou fazer login em uma tela administrativa.
6. Execute **CONECTAR_WHATSAPP.bat**. O programa configura automaticamente a sessão **Ideal Contabilidade**, gera o token interno sem exibi-lo e abre o QR Code para vincular o celular.
7. No celular que ficará conectado, abra **WhatsApp → Dispositivos conectados → Conectar dispositivo** e leia o QR Code. Depois feche a janela antiga **Ideal Zap - API local - 3001**, execute **INICIAR_API.bat** e atualize a interface.

## Endereços locais

- WPPConnect Server deste projeto: http://127.0.0.1:8788
- Adaptador local (mantém o token fora do navegador): http://127.0.0.1:3001
- Interface Ideal Zap: http://127.0.0.1:8080

## Observações importantes

- O nome da sessão é **Ideal Contabilidade**. O script codifica espaços nas URLs automaticamente.
- A porta **8788** evita confundir este projeto com instalações antigas do WPPConnect que possam estar na 8787.
- Não é necessário informar a chave interna nem entrar no Manager. Ela é gerada automaticamente e usada somente pelo script.
- Para vincular a conta do WhatsApp pela primeira vez, ainda é necessário ler o QR Code uma vez no celular. Isso é exigência da vinculação de dispositivos do WhatsApp, não uma senha do Ideal Zap.
- Os dados da sessão ficam em wppconnect-server/userDataDir; não apague essa pasta depois de vincular o telefone.
- Configurações e credenciais ficam em arquivos .env, ignorados pelo Git.
- Se o projeto já tem uma pasta do WPPConnect de versão diferente, o preparador cria backup com data/hora antes de instalar a versão oficial.
- Use a sessão **Ideal_Contabilidade** e não inicie a mesma sessão em dois processos ao mesmo tempo.

## Inicialização habitual

Depois da primeira preparação, normalmente basta executar **INICIAR_TUDO.bat**. Para vincular/revincular, execute **CONECTAR_WHATSAPP.bat**. Depois reinicie a API com **INICIAR_API.bat**.
