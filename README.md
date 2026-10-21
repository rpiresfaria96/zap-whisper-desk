# Zap Whisper Desk

Crie uma aplicação desktop web chamada Ideal Zap, com interface moderna, elegante e profissional, inspirada em aplicativos de mensagens, mas com identidade igual ao whatsapp web.

Layout principal:

Menu lateral estreito com ícones para conversas, contatos, favoritos e configurações.

Coluna de conversas com foto, nome, última mensagem, horário, contador de mensagens não lidas e pesquisa.

Área central com histórico de mensagens em balões, separando mensagens enviadas e recebidas.

Cabeçalho com nome, foto e telefone do contato.

Campo de digitação na parte inferior, com botões para anexos, emojis, enviar e gravar áudio.

Tema claro e escuro.

Design responsivo, animações discretas, ícones consistentes, tipografia moderna e bom espaçamento.

Use React, TypeScript e Tailwind CSS. Quero uma aparência refinada, não um painel administrativo genérico.

Inicialmente, utilize conversas e mensagens fictícias para demonstrar o visual. Organize o código em componentes reutilizáveis.

Integração futura: a aplicação deverá conversar com um backend Node.js local que se conectará ao WPPConnect Server. Não coloque tokens, chaves secretas ou credenciais da API no código do navegador. Não crie uma integração com Supabase nem dependa de serviços em nuvem para o funcionamento local.

Priorize a qualidade visual e a facilidade de personalização. Deixe a interface preparada para posteriormente conectar conversas, histórico, envio de mensagens e atualização em tempo real à API.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9e6866a5-44f3-52eb-b660-26022999a1a5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
