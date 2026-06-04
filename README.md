# 🖥️ Stream Control

> **O Painel definitivo e unificado de controle para Streamers (Multiplataforma & Controle OBS).**

**Stream Control** é uma aplicação web full-stack, moderna e de alta performance, desenvolvida para ajudar streamers das principais plataformas (**Twitch**, **YouTube**, **Kick**, **TikTok** e **X/Twitter**) a gerenciarem suas transmissões de forma integrada. O projeto centraliza o monitoramento de estatísticas em tempo real, unifica os chats de todas as lives em um painel interativo e inteligente, e oferece um controle remoto do seu **OBS Studio** via WebSockets diretamente da sua tela secundária ou celular.

Este é um **projeto público e de código aberto**. Contribuições, reporte de problemas (Issues) e pull requests são extremamente bem-vividas e apreciadas!

---

## 🎨 Principais Recursos

- **🎛️ Painel Remoto OBS**: Troca de cenas, iniciar/parar live, toggle de fontes e controle de volume via WebSocket nativo. Excelente para transformar seu smartphone em um Stream Deck gratuito.
- **💬 Chat Múltiplo Unificado**: Receba e envie mensagens de múltiplos chats (Twitch via TMI.js, e emulação de outras plataformas) em uma interface única integrada com alertas visuais.
- **📈 Métrica e Estatísticas em Tempo Real**: Monitoramento unificado do status de transmissão, número de espectadores ativos, novos seguidores e uptime.
- **🔐 Fluxo de Autenticação Real (OAuth)**: Integrações de login seguras e modernas baseadas no protocolo padrão do setor.
- **🤖 Pronto para IA (opcional)**: Infraestrutura preparada com o moderno SDK `@google/genai` da Google, permitindo futuras integrações de chat-bots de IA de última geração.

---

## 🏗️ Arquitetura Tecnológica

O projeto foi estruturado com foco em velocidade de compilação, simplicidade e facilidade de manutenção de ponta a ponta:

- **Frontend (SPA)**:
  - **React 19 + TypeScript**: Interfaces declarativas, interativas e escaláveis utilizando as últimas recomendações do Ecossistema React.
  - **Vite**: Bundler ultraveloz de desenvolvimento nativo.
  - **Tailwind CSS**: Estilização responsiva e customizada de alta performance visual.
  - **Framer Motion (`motion/react`)**: Micro-animações nativas, transições fluidas e comportamento premium de feedback visual.
  - **Lucide React**: Conjunto limpo e consistente de ícones vetoriais.
  - **Socket.IO-Client**: Comunicação em tempo real para sincronizar o chat do painel e transmissões locais.

- **Backend (Servidor)**:
  - **Express & Node.js**: Rotas de API e infraestrutura leve para proxy de requisições sensíveis, evitando a exposição das chaves de API secretas no cliente web.
  - **Socket.IO (WebSockets)**: Sincronização em tempo real de mensagens e status de lives bidirecionais.
  - **Axios**: Clientes HTTP para interagir de forma robusta com as APIs da Twitch, Kick e YouTube.
  - **Express Session**: Gerenciamento seguro de estado de sessão para os retornos das autenticações do usuário.
  - **esbuild Compilation**: Scripts de build robustos que compilam o TypeScript do servidor backend em um arquivo bundled único super otimizado em `dist/server.cjs` para evitar erros de importação e acelerar inicializações no ambiente de produção.

---

## ⚙️ Guia Completo de Instalação e Execução

### Pré-requisitos
- Node.js LTS (Versão 18 ou superior recomendado)
- Gerenciador de pacotes `npm`

### 1. Clonando o Repositório e Configurando Dependências
```bash
# Clonar o repositório
git clone https://github.com/seu-usuario/stream-control.git
cd stream-control

# Instalar as dependências do projeto
npm install
```

### 2. Configurações de Variáveis de Ambiente (`.env`)
No diretório raiz, crie um arquivo `.env` (baseado no `.env.example` incluído no projeto) e configure as suas credenciais. 

> *Nota: Mantenha as chaves seguras e nunca faça commit do seu arquivo `.env` com dados reais em produção.*

```env
# URL base onde o app está sendo executado (ex: http://localhost:3000 localmente)
APP_URL="http://localhost:3000"

# --- Chave de IA da Google (Opcional) ---
GEMINI_API_KEY="SUA_CHAVE_GEMINI_AQUI"

# --- Chaves da Twitch DX ---
TWITCH_CLIENT_ID="SUA_CLIENT_ID_DA_TWITCH"
TWITCH_CLIENT_SECRET="SUA_CLIENT_SECRET_DA_TWITCH"

# --- Chaves da Kick (Ver seção de problemas conhecidos abaixo) ---
KICK_CLIENT_ID="SUA_CLIENT_ID_DA_KICK"
KICK_CLIENT_SECRET="SUA_CLIENT_SECRET_DA_KICK"

# --- Chaves do YouTube Data API v3 (Google Cloud SDK) ---
YOUTUBE_API_KEY="SUA_GOOGLE_API_KEY_AQUI"

# --- Credenciais de login do Google Cloud / YouTube OAuth ---
GOOGLE_CLIENT_ID="SUA_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="SUA_GOOGLE_CLIENT_SECRET"
GOOGLE_SESSION_SECRET="UMA_FRASE_ALEATORIA_PARA_CRIPTOGRAFIA_DAS_SESSOES"
```

---

### 🚀 Executando o Projeto

Você pode utilizar os seguintes scripts facilitados presentes no `package.json`:

#### Em Modo de Desenvolvimento (Local):
```bash
npm run dev
```
Isso iniciará o servidor usando `tsx` na porta **3000** conectando-se dinamicamente com o Vite em modo middleware. Acesse `http://localhost:3000` no seu navegador.

#### Compilando para Produção:
```bash
npm run build
```
O processo de build criará os assets estáticos otimizados do React de forma otimizada na pasta `/dist` e usará o `esbuild` para gerar o arquivo do servidor backend unificado `dist/server.cjs`.

#### Iniciando em Produção:
```bash
npm run start
```
Isso roda o servidor em modo de alta performance servindo os assets compilados do front-end e executando toda a API robusta do back-end.

---

## 🎛️ Como Usar o Remoto do OBS Studio
1. Abra o seu **OBS Studio** em seu computador local.
2. No menu do OBS, acesse: `Ferramentas -> Configurações do Servidor WebSocket`.
3. Habilite o Servidor WebSocket (porta padrão recomendada: `4455`).
4. Ative uma senha segura e salve.
5. No painel **Stream Control**, clique na aba **OBS**, insira o IP local do seu computador rodando o OBS (ex: se usar em um celular ou tablet dentro de casa, use o IP local do computador tipo `192.168.x.x`) e a senha configurada.
6. Comece a alterar suas cenas e controle sua stream instantaneamente de qualquer tela!

---

## ⚠️ Integração técnica com a Kick.com & Contribuições

Atualmente, o projeto utiliza simulações para teste da plataforma **Kick.com** devido a limitações de acesso aos seus servidores de API.

### O Desafio com a Kick
A API oficial da Kick (`https://id.kick.com` / `https://api.kick.com`) utiliza fortes políticas de proteção contra DDoS e proteção via Cloudflare (como JS Challenges e bloqueio por TLS Fingerprint). Ao tentar trocar o código de autorização utilizando bibliotecas HTTP comuns no Node.js (Axios, Fetch, etc.), a conexão direta é rejeitada pelo firewall da Cloudflare.

Sinta-se livre para propor, testar ou implementar qualquer solução técnica que contorne este problema (por exemplo, proxy reverso personalizado, emulação de TLS client-hello, etc.) ou sugerir novos fluxos alternativos para a plataforma.

### 🚀 Novas Funcionalidades e Caminhos
Como este é um projeto público e de código aberto, não há um caminho previamente engessado ou limitado. Cada desenvolvedor ou streamer pode seguir a direção que desejar e contribuir com o que achar mais valioso! Sinta-se totalmente livre para criar e propor novas ideias, tais como:
- Modificações na interface e experiência de usuário de acordo com o seu gosto.
- Integrações avançadas de chat, moderação e novas plataformas.
- Painéis estatísticos e overlays inovadores para o OBS.
- Novas utilidades personalizadas de controle e automação.

Sinta-se à vontade para abrir uma Issue discutindo novas ideias ou submeter um Pull Request diretamente!

---

## 🤝 Como Contribuir

1. Faça um **Fork** do projeto.
2. Crie uma Branch para a sua feature (`git checkout -b feature/SuaNovaFeature`).
3. Faça commit de suas alterações (`git commit -m 'Adiciona funcionalidade sensacional'`).
4. Envie para o GitHub (`git push origin feature/SuaNovaFeature`).
5. Abre um **Pull Request**.

---

## 📄 Licença

Este projeto é público e licenciado sob a licença **MIT** - consulte o arquivo de [LICENSE](LICENSE) para maiores detalhes.

---
**Stream Control** é feito por streamers para streamers. Junte-se no desenvolvimento para criarmos o melhor ecossistema independente da web! 🚀
