# Stream Control - Guia de Configuração

Esta aplicação está preparada para rodar no ambiente do **AI Studio**. Para que a integração com a Twitch funcione, você precisa configurar seu App no Dashboard de Desenvolvedor da Twitch.

## Configuração da Twitch (OAuth)

1. Vá para o [Twitch Dev Console](https://dev.twitch.tv/console).
2. Crie uma nova aplicação (ou edite uma existente).
3. Insira a seguinte **OAuth Redirect URL**:
   `https://ais-pre-adhoe465ii347vo7prvivx-423361803818.us-west2.run.app/auth/callback`
4. Copie o **Client ID** e o **Client Secret**.

## Configuração no AI Studio

No menu **Settings** (Configurações) do AI Studio Build, adicione as seguintes Secrets (Segredos):

- `TWITCH_CLIENT_ID`: Cole seu Client ID da Twitch aqui.
- `TWITCH_CLIENT_SECRET`: Cole seu Client Secret da Twitch aqui.
- `KICK_CLIENT_ID`: Seu Client ID de integração para a Kick.
- `KICK_CLIENT_SECRET`: Seu Client Secret de integração para a Kick.
- `YOUTUBE_API_KEY`: Sua chave de API do Google Cloud com YouTube Data API v3 ativada.
- `SESSION_SECRET`: Uma frase aleatória para segurança da sessão.

## Funcionalidades
- **Stream Control Remote**: Controle seu OBS diretamente do celular (troca de cenas, start/stop stream).
- **Conexões Reais**: Use o botão da Twitch para logar via OAuth e puxar seu chat automaticamente.
- **Multistream**: Adicione outras plataformas manualmente para monitorar usuários.
- **Chat Unificado**: Centralize as mensagens de diferentes fontes em uma única aba.

## Uso do OBS Remote Control
1. No OBS, vá em `Tools -> WebSocket Server Settings`.
2. Habilite o servidor WebSockets (Porta padrão: 4455).
3. No **Stream Control**, vá na aba OBS, insira o IP do seu computador e a senha definida.
4. *Dica: Se estiver usando o Stream Control no celular, use o IP local do seu PC (ex: 192.168.1.XX).*
