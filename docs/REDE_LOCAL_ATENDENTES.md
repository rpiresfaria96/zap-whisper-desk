# Ideal-Zap na rede local — estado da cópia recebida em 29/10/2026

A Central `INICIAR_DISCRETO.vbs` inicia a interface em `http://127.0.0.1:8080/`. O segundo computador da mesma rede privada pode abrir `http://IP_DO_COMPUTADOR_PRINCIPAL:8080/`. Utilize `ipconfig` no PC principal para descobrir o IPv4.

**Não existe login nem assinatura automática por atendente.** A assinatura foi removida a pedido do usuário. Todas as mensagens são enviadas como digitadas; as conversas e leituras são compartilhadas entre os navegadores.

**Segurança:** a interface 8080 não possui autenticação. Não a exponha à internet e permita o acesso no firewall somente na rede privada confiável. Notificações do sistema podem não funcionar no segundo computador por restrições de segurança a HTTP sem HTTPS.

O botão `Encerrar` da Central finaliza somente serviços locais e **não** desvincula a conta do WhatsApp. A troca de sessão/novo QR é uma função diferente, ainda pendente de testes reais.
