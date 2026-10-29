# Prioridade: Manager original antes de novos recursos

Revisão de 23/10/2026, após o LOG_DIAGNOSTICO(9).txt e conferência
direta dos fontes oficiais WPPConnect Manager v2.0.0 e
WPPConnect Server v2.10.61. Este documento **não** considera CI como prova
de funcionamento no celular.

## O que o Manager original oferece

| Parte do Manager v2.0.0 | Estado atual do Ideal-Zap |
| --- | --- |
| Conectar sessão via QR e consultar status | ✅ confirmado nos testes do usuário |
| Consultar conversas / contatos / grupos | ✅ funcionando, contatos duplicados em revisão |
| Abrir histórico de mensagens | ✅ até 80 recentes por conversa; históricos limitados ainda são melhoria |
| Enviar texto e arquivo | ✅ pelo usuário; áudio antigo ainda depende do WhatsApp |
| Ver mídia recebida (imagem, vídeo, áudio, documento) | ⚠️ algumas mídias indisponíveis precisam de reteste |
| Receber atualizações de mensagens via eventos WPP | 🧪 agora usando **webhook nativo** autenticado de `start-session`, que alimenta SSE local |
| Encerrar sessão sem logout | 🧪 novo botão em Configurações, rota oficial `close-session` |
| Desvincular sessão e solicitar novo QR | 🧪 novo botão separado, confirmação reforçada, rota oficial `logout-session` |
| Tema claro e escuro | ✅ funcionando |
| Atualizar listas manualmente | ✅ |
| Português na interface | ✅; idioma inglês não priorizado |
| Criar grupos | 🚫 usuário NÃO quer, botão retirado |
| Criar múltiplas sessões | 🚫 usuário NÃO quer |
| Perfis remotos e gestão de múltiplos servidores | 🚫 fora do escopo de servidor local único |

Outros recursos como apagar para todos, encaminhar nativo, notificações
nativas do Windows, estrelas sincronizadas, reações e edição pertencem
à API mais ampla / WhatsApp Web, **não ao chat básico do Manager 2.0.0**.
Preservamos o que já existe no Ideal-Zap, mas não declaramos as ações
remotas não verificadas como prontas. Serão retomadas depois de estabilizar
o Manager, conforme pedido explícito.

## Correções para testar agora

1. **Não reutilizar processos antigos.** `INICIAR.bat` avisa e interrompe
   se o WPPConnect, a API ou a interface já estiverem usando as portas
   habituais. Isso impede testes falsos de uma atualização do GitHub
   contra um programa antigo ainda em memória. Feche somente as janelas
   antigas antes de iniciar; não apague dados da sessão.
2. **Eventos oficiais:** a API, ao enviar `start-session`, configura a URL
   nativa de webhook do WPPConnect, autorizada pela allowlist local.
   O backend recebe o formato oficial de evento diretamente e repassa
   notificações para a interface via SSE sem expor o token. Removemos
   a injeção antiga `BRIDGE_ONMESSAGE` do código WPPConnect local.
   Desabilitamos `webhook.autoDownload` e `webhook.readMessage` para
   evitar anexos em base64 e marcação de leitura inadvertida.
3. **Duplicados:** os registros do WhatsApp podem trazer o mesmo contato
   como `@lid` e `@c.us`. Mantivemos a filtragem anterior de IDs e pares
   isolados de nomes, mais uma consulta à rota **oficial**
   `contact/pn-lid/:pnLid` para LIDs remanescentes. Só descartamos um
   segundo ID extra se a API devolver o vínculo PN/LID exato para um
   `@c.us` já presente. Mapeamentos desconhecidos permanecem visíveis
   para não apagar pessoas diferentes com nomes iguais. Até 30 consultas
   por atualização e cache evitam sobrecarregar o WhatsApp.
4. **Sessão:** botão `Encerrar sessão (preserva vínculo)` encerra a sessão
   atual sem eliminar token/perfil. O botão `Desvincular e ler novo QR`
   é diferente e requer confirmar duas vezes, inclusive digitar
   DESVINCULAR; o WPPConnect **remove autenticação local** dessa sessão.
   Nenhum outro WhatsApp/sessão é criado automaticamente.

## Conferência no Windows

1. Feche as três janelas do Ideal-Zap (WPPConnect 8788, API 3001,
   Interface 8080). Atualize **feat/conexao-whatsapp-na-interface** com
   Fetch/Pull no GitHub Desktop e execute **somente** `INICIAR.bat`.
   Se a porta estiver ocupada, feche o processo antigo e repita.
2. Abra Contatos e compare nomes/telefones repetidos. O novo log exibe
   `CONTACT_LID_CHECK` e `CONTACTS_LOADED`; compartilhe apenas
   o novo log técnico se ainda houver duplicação.
3. Deixe o Ideal-Zap aberto e receba uma mensagem de outra conta de teste.
   O webhook oficial deve registrar `INCOMING_EVENT_RELAYED` com
   `source: NATIVE`. Som e notificação do sistema dependem da permissão
   do navegador e continuam aguardando confirmação real.
4. Em **Configurações → Sessão do WhatsApp**, experimente primeiro
   `Encerrar sessão (preserva vínculo)` e depois `Iniciar / tentar novamente`
   na tela de conexão. A autenticação salva costuma permitir voltar
   sem novo QR.
5. **Só se quiser testar novo QR**, escolha `Desvincular e ler novo QR`.
   Esta ação desassocia o aparelho e apaga os dados locais de
   autenticação daquela sessão WPP; não apaga conversas do celular.
   Não é necessário para testar o encerramento normal.
6. Validar conversa, contatos, grupos, envio de texto, arquivos,
   visualização e atualização de mensagens. Registrar qualquer falha
   na mesma execução e enviar `LOG_DIAGNOSTICO.txt`.

Não expor `.env`, tokens, QR, telefones, mensagens ou `userDataDir`.
O CI verifica sintaxe, mocks de operações WPP, SSE, TS e UI, não
um aparelho de WhatsApp real. Manter `main` intacta e PR em rascunho.
