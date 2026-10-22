# Ideal Zap — ambiente local integrado

Este repositório reúne a interface do Ideal Zap, o adaptador HTTP local para WPPConnect Server e scripts que baixam o WPPConnect oficial dentro desta mesma pasta. O WPPConnect permanece em uma subpasta ignorada pelo Git para não misturar os códigos-fonte dos dois projetos.

## Preparação em uma pasta

1. Baixe este repositório em **Code → Download ZIP** e extraia-o para uma pasta de trabalho.
2. Execute `PREPARAR_AMBIENTE.bat`.
3. O preparador baixa uma cópia portátil do Node.js v22.22.2, verifica o SHA-256 do arquivo, baixa o WPPConnect Server oficial v2.10.61, adiciona o pacote estático oficial WPPConnect Manager v2.0.0 com verificação SHA-256, gera uma `SECRET_KEY` forte e instala as dependências da interface e do servidor. Não precisa instalar o Node globalmente.
4. Execute `INICIAR_TUDO.bat`.
5. Abra o Manager em `http://127.0.0.1:8787/manager/`. Use a `SECRET_KEY` de `wppconnect-server/.env` para acesso administrativo; crie/inicie a sessão `Ideal` e leia o QR Code com seu celular.
6. Depois, execute `CONECTAR_WHATSAPP.bat`: ele gera o token da sessão e abre o QR Code automaticamente. O campo `token` (hash) vai para `backend/.env`; não use `full`, pois esse campo inclui também o nome da sessão:
   - `WPP_SESSION=Ideal`
   - `WPP_TOKEN=` recebe apenas o valor de `token` retornado por `generate-token` (não o campo `full`).
7. Salve `backend/.env` e reinicie somente a janela **Ideal Zap - API local**. Abra/atualize a interface em `http://127.0.0.1:8080/`.

## Endereços locais

- WPPConnect Server: `http://127.0.0.1:8787`
- WPPConnect Manager: `http://127.0.0.1:8787/manager/`
- Adaptador local (mantém o token fora do navegador): `http://127.0.0.1:3001`
- Interface Ideal Zap: `http://127.0.0.1:8080`

## Notas

- Os dados do servidor ficam em `wppconnect-server/userDataDir`; não apague essa pasta depois de vincular o telefone.
- As configurações e credenciais ficam em arquivos `.env`, que não devem ser enviados ao GitHub.
- Se a pasta `wppconnect-server` já existir com outra versão, o preparador a renomeia para `wppconnect-server.backup-DATA-HORA`, em vez de apagá-la.
- O código do backend e da interface é desenvolvido no projeto principal. O código baixado do WPPConnect fica separado em `wppconnect-server`, dentro do mesmo diretório de trabalho.
- O WPPConnect Server oficial v2.10.61 especifica Node.js v22.22.2. O preparador usa essa versão portátil no projeto sem substituir o Node que já esteja instalado no Windows.
- Não use o Manager e a interface personalizada para criar várias sessões concorrentes com o mesmo diretório de perfil. Use a sessão `Ideal` e valide a conexão antes de testar envio de mensagens.

## Inicialização

Execute `PREPARAR_AMBIENTE.bat` uma vez. Depois, normalmente basta executar `INICIAR_TUDO.bat`. O iniciador aguarda até 120 segundos o endpoint de saúde do WPPConnect antes de abrir o adaptador e a interface. As três janelas de terminal abertas precisam permanecer ativas.
