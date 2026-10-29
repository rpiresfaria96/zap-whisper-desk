# Ideal-Zap — manutenção do código

Este repositório contém a interface WhatsApp, o adaptador Node e o código-fonte do WPPConnect Server que acompanha a instalação local.

- Faça alterações pequenas, testáveis e preserve o funcionamento atual da sessão.
- Não faça modificações ou commits em `.env`, `tokens`, `userDataDir`, logs, bancos locais, caches, `node_modules` ou `runtime`.
- Nunca remova tokens ou dados de sessão para resolver erros de inicialização.
- Não envie mensagens reais automaticamente durante testes.
- Use `INICIAR_DISCRETO.vbs` para iniciar os serviços sem janelas CMD; `INICIAR.bat` é o iniciador antigo e permanece apenas para compatibilidade.
- O serviço WhatsApp usa WPPConnect-Server v2.10.61, API local em 3001 e interface em 8080.
- Não implemente assinatura automática nas mensagens: esse recurso foi removido a pedido do usuário.
- O projeto não contém dados pessoais de sessão.
- Não configure publicação automática para remotos ou GitHub Actions em cada alteração.
