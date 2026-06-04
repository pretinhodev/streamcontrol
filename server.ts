import express from "express";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import session from "express-session";
import axios from "axios";

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const PORT = 3000;

  // Session configuration for OAuth
  app.use(session({
    secret: process.env.SESSION_SECRET || "streamcontrol-secret-123",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true, sameSite: 'none' }
  }));

  // Initial mock stats (fallback)
  let streamStats = {
    viewers: 0,
    followers: 0,
    uptime: "Offline",
    title: "Conecte seu Twitch para ver dados reais",
    category: "Nenhuma",
  };

  // Socket.IO logic
  io.on("connection", (socket) => {
    socket.emit("stats:update", streamStats);
    socket.on("chat:message", (msg) => {
      io.emit("chat:message", {
        id: Date.now().toString(),
        user: msg.user || "Anônimo",
        text: msg.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        color: msg.color || "#FF0080",
      });
    });
  });

  // --- Twitch OAuth Routes ---

  app.get("/api/auth/twitch/url", (req, res) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const host = req.get('host');
    const protocol = req.protocol === 'http' && host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/auth/callback`;
    
    if (!clientId) {
      return res.status(400).json({ error: "TWITCH_CLIENT_ID não configurado" });
    }

    const scopes = [
      "chat:read",
      "chat:edit",
      "channel:read:subscriptions",
      "moderator:read:followers",
      "channel:manage:broadcast"
    ].join(" ");

    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const host = req.get('host');
    const protocol = req.protocol === 'http' && host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/auth/callback`;

    try {
      const response = await axios.post("https://id.twitch.tv/oauth2/token", null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        },
      });

      const { access_token, refresh_token } = response.data;
      
      // Get user info to get the channel name
      const userRes = await axios.get("https://api.twitch.tv/helix/users", {
        headers: {
          "Client-ID": clientId,
          "Authorization": `Bearer ${access_token}`
        }
      });

      const userData = userRes.data.data[0];
      
      // Store in session (simplified for this demo)
      (req as any).session.twitchToken = access_token;
      (req as any).session.twitchUser = userData;

      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                token: '${access_token}',
                user: ${JSON.stringify(userData)}
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Twitch OAuth Error:", error.response?.data || error.message);
      res.status(500).send("Erro na autenticação com Twitch");
    }
  });

  app.get("/api/twitch/me", (req, res) => {
    const user = (req as any).session.twitchUser;
    const token = (req as any).session.twitchToken;
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    res.json({ user, token, clientId });
  });

  app.get("/api/twitch/stats", async (req, res) => {
    const { userId, username, token } = req.query;
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId) {
      return res.status(400).json({ error: "TWITCH_CLIENT_ID não configurado" });
    }

    let headerToken = token || (req as any).session.twitchToken;

    try {
      if (!headerToken && clientSecret) {
        try {
          const tokenRes = await axios.post("https://id.twitch.tv/oauth2/token", null, {
            params: {
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: "client_credentials"
            }
          });
          headerToken = tokenRes.data.access_token;
        } catch (tokErr: any) {
          console.error("Error fetching Twitch app token:", tokErr.message);
        }
      }

      if (!headerToken) {
        return res.status(400).json({ error: "Nenhum token válido do Twitch encontrado para a requisição." });
      }

      let isLive = false;
      let viewers = 0;
      let title = "Stream Offline";
      
      try {
        const streamRes = await axios.get(`https://api.twitch.tv/helix/streams`, {
          params: userId ? { user_id: userId } : { user_login: username },
          headers: {
            "Client-ID": clientId,
            "Authorization": `Bearer ${headerToken}`
          }
        });
        
        if (streamRes.data?.data?.length > 0) {
          const streamInfo = streamRes.data.data[0];
          isLive = streamInfo.type === "live";
          viewers = streamInfo.viewer_count || 0;
          title = streamInfo.title || "Live Ativa";
        }
      } catch (streamErr: any) {
        console.error("Error fetching Twitch live stream:", streamErr.response?.data || streamErr.message);
      }

      let followers = 0;
      if (userId) {
        try {
          const followersRes = await axios.get(`https://api.twitch.tv/helix/channels/followers`, {
            params: { broadcaster_id: userId },
            headers: {
              "Client-ID": clientId,
              "Authorization": `Bearer ${headerToken}`
            }
          });
          if (followersRes.data?.total !== undefined) {
            followers = followersRes.data.total;
          }
        } catch (followErr: any) {
          console.error("Error fetching Twitch followers count:", followErr.response?.data || followErr.message);
        }
      }

      res.json({
        isLive,
        viewers,
        followers,
        title
      });

    } catch (err: any) {
      console.error("Twitch API Stats Error:", err.response?.data || err.message);
      res.status(500).json({ error: "Erro ao buscar estatísticas da Twitch" });
    }
  });

  // --- Kick OAuth Routes ---
  app.get("/api/auth/kick/url", (req, res) => {
    const clientId = process.env.KICK_CLIENT_ID;
    const host = req.get('host');
    const protocol = req.protocol === 'http' && host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    
    // Se o cliente configurou um KICK_CLIENT_ID real (não nulo e diferente de temporário)
    if (clientId && clientId !== "kick_mock_client_id_temp" && clientId.trim() !== "") {
      const redirectUri = `${baseUrl}/auth/kick/callback`;
      const scopes = "user.read channel.read"; // escopos padrão da API de parceiros do id.kick.com
      const url = `https://id.kick.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
      return res.json({ url });
    }
    
    // Fallback de Sandbox/Simulação quando as chaves de produção ainda não estão ativas
    res.json({ url: `${baseUrl}/auth/kick?client_id=kick_simulated_client_id` });
  });

  // Callback oficial para id.kick.com
  app.get("/auth/kick/callback", async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.KICK_CLIENT_ID;
    const clientSecret = process.env.KICK_CLIENT_SECRET;
    const host = req.get('host');
    const protocol = req.protocol === 'http' && host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/auth/kick/callback`;

    try {
      const tokenParams = new URLSearchParams();
      tokenParams.append("client_id", clientId || "");
      tokenParams.append("client_secret", clientSecret || "");
      tokenParams.append("code", (code as string) || "");
      tokenParams.append("grant_type", "authorization_code");
      tokenParams.append("redirect_uri", redirectUri);

      // Requerimento POST seguro de troca de código por código de autorização do id.kick.com usando x-www-form-urlencoded padrão do OAuth 2.0 / 2.1
      const response = await axios.post("https://id.kick.com/oauth/token", tokenParams, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        }
      });

      const { access_token } = response.data;

      // Chama a API pública de informações do usuário logado via id.kick.com
      const userRes = await axios.get("https://api.kick.com/public/v1/users/me", {
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Accept": "application/json"
        }
      });

      const userData = userRes.data;
      
      const userPayload = {
        id: userData.id || 'kick_' + Math.random().toString(36).substr(2, 9),
        username: userData.username || userData.slug || 'kick_streamer',
        display_name: userData.username || userData.slug || 'Kick Streamer',
        profile_image_url: userData.profile_picture || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + (userData.username || 'kick')
      };

      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'KICK_AUTH_SUCCESS', 
                token: '${access_token}',
                user: ${JSON.stringify(userPayload)}
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      const statusStr = error.response ? `HTTP ${error.response.status}` : "Sem Resposta";
      const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error("Erro na autenticação Kick real:", errorDetail);
      res.status(500).send(`
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Erro de Conexão - Kick</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-[#0b0e11] text-neutral-300 flex items-center justify-center min-h-screen font-sans">
            <div class="max-w-md p-8 bg-[#191b1f] border border-neutral-800 rounded-3xl text-center shadow-xl">
              <h2 class="text-xl font-black text-red-500 mb-4">Falha no id.kick.com 🔌</h2>
              <p class="text-xs text-neutral-400 mb-6">O servidor oficial da Kick rejeitou a requisição do OAuth. Verifique se o seu CLIENT_ID, CLIENT_SECRET, ou a Redirect URI mapeada estão corretos.</p>
              <div class="text-[11px] text-red-400 font-mono mb-6 bg-red-950/20 p-4 rounded-2xl border border-red-900/30 text-left overflow-auto max-h-40 break-words space-y-1">
                <div><strong class="text-white">Status:</strong> ${statusStr}</div>
                <div><strong class="text-white">Detalhes:</strong> ${errorDetail}</div>
                <div><strong class="text-white">Redirect URI:</strong> ${redirectUri}</div>
              </div>
              <button onclick="window.close()" class="px-5 py-3 bg-neutral-800/80 text-white rounded-xl text-xs font-bold hover:bg-neutral-700 transition-all border border-neutral-700/30">Fechar Janela</button>
            </div>
          </body>
        </html>
      `);
    }
  });

  app.get("/auth/kick", (req, res) => {
    const clientId = (req.query.client_id as string) || "Não configurado";
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conectar Kick ao Stream Control</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght=400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #0b0e11; }
        </style>
      </head>
      <body class="flex flex-col items-center justify-center min-h-screen text-neutral-200 px-4 py-8">
        <!-- Banner Informativo da Solução id.kick.com -->
        <div class="w-full max-w-md mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] p-3.5 rounded-2xl flex flex-col gap-1 shadow-lg leading-relaxed">
          <div class="font-bold flex items-center gap-1 text-[12px]">
            <span>⚡ Modo Sandbox (id.kick.com)</span>
          </div>
          <p class="opacity-80">KICK_CLIENT_ID não configurado nos Secrets do AI Studio. O painel iniciou a simulação do id.kick.com de forma totalmente interativa para você validar os fluxos em tempo de desenvolvimento!</p>
        </div>

        <div class="w-full max-w-md bg-[#191b1f] border border-neutral-800 rounded-[32px] p-7 shadow-2xl relative overflow-hidden">
          <div class="absolute -top-12 -right-12 w-36 h-36 bg-[#53FC18]/10 rounded-full blur-3xl"></div>
          
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-1.5">
              <span class="text-white font-black text-xl tracking-tight">Stream<span class="text-[#53FC18]"> Control</span></span>
              <span class="bg-[#24262b] text-[9px] font-mono font-bold text-neutral-400 px-1.5 py-0.5 rounded-full">v2_api</span>
            </div>
            <span class="bg-[#53FC18]/10 text-[#53FC18] text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#53FC18]/20">Seguro</span>
          </div>

          <div class="flex flex-col items-center text-center space-y-3 mb-6">
            <div class="w-16 h-16 rounded-2xl bg-[#5cff27]/10 border border-[#53FC18]/30 flex items-center justify-center text-[#53FC18] text-4xl font-extrabold shadow-lg shadow-[#53FC18]/5">
              <span>K</span>
            </div>
            <h2 class="text-lg font-black text-white">Adicionar Canal do Kick</h2>
            <div class="text-[9px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800/60 px-3 py-1.5 rounded-lg max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
              Client ID: <span class="text-[#53FC18]">${clientId}</span>
            </div>
            <p class="text-xs text-neutral-400 leading-relaxed max-w-md">
              Autorize o <strong>Stream Control Mobile</strong> a gerenciar alertas e integrar o feed de eventos de stream das suas transmissões.
            </p>
          </div>

          <div class="bg-[#111317] border border-neutral-800/45 rounded-2xl p-4.5 mb-6 space-y-3.5">
            <span class="text-[9px] font-black tracking-widest text-[#534e4e] uppercase block">Permissões Solicitadas pelo Applet:</span>
            <div class="space-y-2.5">
              <div class="flex items-start gap-2.5 text-xs text-neutral-300">
                <span class="text-[#53FC18] mt-0.5 font-bold">✓</span>
                <p>Receber alertas de <strong>Seguidores & Subs</strong> instantâneos</p>
              </div>
              <div class="flex items-start gap-2.5 text-xs text-neutral-300">
                <span class="text-[#53FC18] mt-0.5 font-bold">✓</span>
                <p>Incorporar visualizadores totais e status da live</p>
              </div>
              <div class="flex items-start gap-2.5 text-xs text-neutral-300">
                <span class="text-[#53FC18] mt-0.5 font-bold">✓</span>
                <p>Acesso de gravação para controle simultâneo no OBS</p>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Nome do Canal do Kick</label>
              <input 
                id="username" 
                type="text" 
                placeholder="ex: alanzoka" 
                class="w-full bg-[#0d0f12] border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-[#53FC18] focus:ring-1 focus:ring-[#53FC18]/20 transition-all font-mono"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Nome de Exibição / Apelido</label>
              <input 
                id="displayName" 
                type="text" 
                placeholder="ex: Alan Kick Live" 
                class="w-full bg-[#0d0f12] border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-[#53FC18] focus:ring-1 focus:ring-[#53FC18]/20 transition-all"
              />
            </div>

            <div class="flex gap-3 pt-3">
              <button onclick="window.close()" class="w-1/2 bg-[#222] hover:bg-neutral-800 text-neutral-400 py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">Cancelar</button>
              <button onclick="authorize()" class="w-1/2 bg-[#53FC18] hover:bg-[#4ddf15] text-[#05050A] py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-[#53FC18]/10 cursor-pointer">Autorizar</button>
            </div>
          </div>
        </div>

        <script>
          function authorize() {
            var rawUser = document.getElementById('username').value.trim();
            if (!rawUser) {
              alert('Por favor, informe seu nome de usuário do Kick.');
              return;
            }
            var disp = document.getElementById('displayName').value.trim() || rawUser;
            
            window.opener.postMessage({
              type: 'KICK_AUTH_SUCCESS',
              user: {
                id: 'kick_' + Math.random().toString(36).substr(2, 9),
                username: rawUser,
                display_name: disp,
                profile_image_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=' + rawUser
              }
            }, '*');
            
            window.close();
          }
        </script>
      </body>
      </html>
    `);
  });

  // --- TikTok OAuth Mock Routes ---
  app.get("/api/auth/tiktok/url", (req, res) => {
    const host = req.get('host');
    const protocol = req.protocol === 'http' && host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    res.json({ url: `${baseUrl}/auth/tiktok` });
  });

  app.get("/auth/tiktok", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conectar TikTok ao Stream Control</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #030303; }
        </style>
      </head>
      <body class="flex flex-col items-center justify-center min-h-screen text-neutral-200 px-4">
        <div class="w-full max-w-md bg-[#121212] border border-neutral-800 rounded-[32px] p-7 shadow-2xl relative overflow-hidden">
          <div class="absolute -top-12 -left-12 w-32 h-32 bg-[#25F4EE]/10 rounded-full blur-3xl"></div>
          <div class="absolute -bottom-12 -right-12 w-32 h-32 bg-[#FE2C55]/10 rounded-full blur-3xl"></div>
          
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-1.5">
              <span class="text-white font-black text-xl tracking-tight">Stream<span class="text-[#FE2C55]"> Control</span></span>
              <span class="bg-[#1e1e1e] text-[9px] font-mono font-bold text-neutral-400 px-1.5 py-0.5 rounded-full">v2_api</span>
            </div>
            <span class="bg-[#FE2C55]/10 text-[#FE2C55] text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#FE2C55]/20">Seguro</span>
          </div>

          <div class="flex flex-col items-center text-center space-y-3 mb-6">
            <div class="w-16 h-16 rounded-2xl bg-[#FE2C55]/5 border border-[#FE2C55]/20 flex items-center justify-center text-white text-3xl font-extrabold shadow-lg">
              <svg class="w-8 h-8 fill-current" viewBox="0 0 24 24">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm3.85 7.43a2.71 2.71 0 0 1-.29 0c-.57-.07-1.12-.29-1.56-.63v4.61a3.86 3.86 0 1 1-3.86-3.86 3.82 3.82 0 0 1 .85.09v1.94a1.9 1.9 0 1 0-.85 1.82 1.89 1.89 0 0 0 2-.09V6h2a2.75 2.75 0 0 0 1.71 1.71v1.72z" />
              </svg>
            </div>
            <h2 class="text-lg font-black text-white">Adicionar TikTok Live</h2>
            <p class="text-xs text-neutral-400 leading-relaxed max-w-sm">
              Autorize os serviços do <strong>Stream Control</strong> a obter sua contagem de visualizadores e gerenciar notificações de chat online.
            </p>
          </div>

          <div class="bg-[#181818] border border-neutral-800/45 rounded-2xl p-4.5 mb-6 space-y-3.5">
            <span class="text-[9px] font-black tracking-widest text-neutral-500 uppercase block">Permissões Solicitadas:</span>
            <div class="space-y-2.5">
              <div class="flex items-start gap-2.5 text-xs text-neutral-300">
                <span class="text-[#FE2C55] mt-0.5 font-bold">✓</span>
                <p>Capturar stream de chat em tempo real</p>
              </div>
              <div class="flex items-start gap-2.5 text-xs text-neutral-300">
                <span class="text-[#25F4EE] mt-0.5 font-bold">✓</span>
                <p>Monitoramento de eventos de Presentes & Doações</p>
              </div>
            </div>
          </div>

          <div class="space-y-3.5">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Nome do Usuário (@username)</label>
              <input 
                id="username" 
                type="text" 
                placeholder="ex: @streamer_oficial" 
                class="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-[#FE2C55] focus:ring-1 focus:ring-[#FE2C55]/20 transition-all font-mono"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Apelido de Exibição</label>
              <input 
                id="displayName" 
                type="text" 
                placeholder="ex: Meu Perfil TikTok" 
                class="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-[#FE2C55] focus:ring-1 focus:ring-[#FE2C55]/20 transition-all"
              />
            </div>

            <div class="flex gap-3 pt-3">
              <button onclick="window.close()" class="w-1/2 bg-[#1a1a1a] hover:bg-neutral-800 text-neutral-400 py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">Cancelar</button>
              <button onclick="authorize()" class="w-1/2 bg-[#FE2C55] hover:bg-[#e02449] text-white py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg cursor-pointer">Autorizar</button>
            </div>
          </div>
        </div>

        <script>
          function authorize() {
            var rawUser = document.getElementById('username').value.trim();
            if (!rawUser) {
              alert('Por favor, informe seu usuário do TikTok.');
              return;
            }
            if (rawUser.charAt(0) !== '@') {
              rawUser = '@' + rawUser;
            }
            var disp = document.getElementById('displayName').value.trim() || rawUser;
            
            window.opener.postMessage({
              type: 'TIKTOK_AUTH_SUCCESS',
              user: {
                id: 'tiktok_' + Math.random().toString(36).substr(2, 9),
                username: rawUser,
                display_name: disp,
                profile_image_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + rawUser
              }
            }, '*');
            
            window.close();
          }
        </script>
      </body>
      </html>
    `);
  });

  // --- X (Twitter) OAuth Mock Routes ---
  app.get("/api/auth/x/url", (req, res) => {
    const host = req.get('host');
    const protocol = req.protocol === 'http' && host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    res.json({ url: `${baseUrl}/auth/x` });
  });

  app.get("/auth/x", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conectar X ao Stream Control</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; background-color: #000000; }
        </style>
      </head>
      <body class="flex flex-col items-center justify-center min-h-screen text-neutral-200 px-4">
        <div class="w-full max-w-md bg-[#090909] border border-neutral-800 rounded-[32px] p-7 shadow-2xl relative overflow-hidden">
          
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-1.5">
              <span class="text-white font-black text-xl tracking-tight">Stream<span class="text-neutral-400"> Control</span></span>
              <span class="bg-[#161616] text-[9px] font-mono font-bold text-neutral-500 px-1.5 py-0.5 rounded-full">v2_api</span>
            </div>
            <span class="bg-neutral-800/50 text-[#fff] text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-neutral-800">Verificado</span>
          </div>

          <div class="flex flex-col items-center text-center space-y-3 mb-6">
            <div class="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white text-3xl font-extrabold shadow-lg">
              <span>X</span>
            </div>
            <h2 class="text-lg font-black text-white">Autorizar Stream Control no X</h2>
            <p class="text-xs text-neutral-400 leading-relaxed max-w-sm">
              Conecte sua conta do X para transmitir o status da sua live e alertar seus seguidores em tempo real.
            </p>
          </div>

          <div class="bg-[#111] border border-neutral-800/45 rounded-2xl p-4.5 mb-6 space-y-3.5">
            <span class="text-[9px] font-black tracking-widest text-neutral-500 uppercase block">Permissões de Conta Mídia:</span>
            <div class="space-y-2.5">
              <div class="flex items-start gap-2.5 text-xs text-neutral-300">
                <span class="text-white mt-0.5 font-bold">✓</span>
                <p>Publicação automática de link ao iniciar live</p>
              </div>
              <div class="flex items-start gap-2.5 text-xs text-neutral-300">
                <span class="text-white mt-0.5 font-bold">✓</span>
                <p>Acessar estatísticas e engajamento da publicação</p>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Usuário no X (@perfil)</label>
              <input 
                id="username" 
                type="text" 
                placeholder="ex: @streamer_tech" 
                class="w-full bg-[#050505] border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all font-mono"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Nome de exibição</label>
              <input 
                id="displayName" 
                type="text" 
                placeholder="ex: Meu Usuário X" 
                class="w-full bg-[#050505] border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>

            <div class="flex gap-3 pt-3">
              <button onclick="window.close()" class="w-1/2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">Cancelar</button>
              <button onclick="authorize()" class="w-1/2 bg-white hover:bg-neutral-200 text-black py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer">Autorizar</button>
            </div>
          </div>
        </div>

        <script>
          function authorize() {
            var rawUser = document.getElementById('username').value.trim();
            if (!rawUser) {
              alert('Por favor, informe seu usuário do X.');
              return;
            }
            if (rawUser.charAt(0) !== '@') {
              rawUser = '@' + rawUser;
            }
            var disp = document.getElementById('displayName').value.trim() || rawUser;
            
            window.opener.postMessage({
              type: 'X_AUTH_SUCCESS',
              user: {
                id: 'x_' + Math.random().toString(36).substr(2, 9),
                username: rawUser,
                display_name: disp,
                profile_image_url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' + rawUser
              }
            }, '*');
            
            window.close();
          }
        </script>
      </body>
      </html>
    `);
  });

  // --- YouTube OAuth Routes ---

  app.get("/api/auth/youtube/url", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID; // Google Client ID
    const host = req.get('host');
    const protocol = req.protocol === 'http' && host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/auth/youtube/callback`;
    
    if (!clientId) {
      return res.status(400).json({ error: "GOOGLE_CLIENT_ID não configurado. Verifique as configurações de OAuth." });
    }

    const scopes = [
      "https://www.googleapis.com/auth/youtube.readonly"
    ].join(" ");

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
    res.json({ url });
  });

  app.get("/auth/youtube/callback", async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const host = req.get('host');
    const protocol = req.protocol === 'http' && host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/auth/youtube/callback`;

    try {
      const response = await axios.post("https://oauth2.googleapis.com/token", null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        },
      });

      const { access_token, refresh_token } = response.data;
      
      // Get Channel Info
      const channelRes = await axios.get("https://www.googleapis.com/youtube/v3/channels", {
        params: { 
          part: 'snippet,statistics',
          mine: true
        },
        headers: {
          "Authorization": `Bearer ${access_token}`
        }
      });

      const channelData = channelRes.data.items[0];
      
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'YOUTUBE_AUTH_SUCCESS', 
                token: '${access_token}',
                channel: ${JSON.stringify(channelData)}
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("YouTube OAuth Error:", error.response?.data || error.message);
      res.status(500).send("Erro na autenticação com YouTube");
    }
  });

  // --- YouTube API Routes ---
  app.get("/api/youtube/stats", async (req, res) => {
    const { channelId, username } = req.query;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: "YOUTUBE_API_KEY não configurada" });
    }

    try {
      let id = channelId;
      
      // If username is provided, we need to find the channel ID first
      if (username && !id) {
        const searchUser = await axios.get(`https://www.googleapis.com/youtube/v3/channels`, {
          params: {
            part: 'id',
            forUsername: username,
            key: apiKey
          }
        });
        if (searchUser.data.items?.length > 0) {
          id = searchUser.data.items[0].id;
        } else {
          // Fallback: try searching for the name if forUsername fails (it often does for modern handles)
          const searchHandle = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
            params: {
              part: 'snippet',
              q: username,
              type: 'channel',
              maxResults: 1,
              key: apiKey
            }
          });
          if (searchHandle.data.items?.length > 0) {
            id = searchHandle.data.items[0].id.channelId;
          }
        }
      }

      if (!id) {
        return res.status(404).json({ error: "Canal não encontrado" });
      }

      // 1. Get Channel Stats (Subscribers)
      const channelRes = await axios.get(`https://www.googleapis.com/youtube/v3/channels`, {
        params: {
          part: 'statistics,snippet',
          id: id,
          key: apiKey
        }
      });

      const channel = channelRes.data.items[0];
      const stats = {
        subscribers: parseInt(channel.statistics.subscriberCount),
        viewCount: parseInt(channel.statistics.viewCount),
        title: channel.snippet.title,
        thumbnails: channel.snippet.thumbnails,
        isLive: false,
        concurrentViewers: 0
      };

      // 2. Check for Live Stream
      const liveSearch = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
        params: {
          part: 'snippet',
          channelId: id,
          type: 'video',
          eventType: 'live',
          key: apiKey
        }
      });

      if (liveSearch.data.items?.length > 0) {
        stats.isLive = true;
        const videoId = liveSearch.data.items[0].id.videoId;
        
        // 3. Get Live Viewers
        const videoRes = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
          params: {
            part: 'liveStreamingDetails',
            id: videoId,
            key: apiKey
          }
        });

        if (videoRes.data.items?.length > 0) {
          stats.concurrentViewers = parseInt(videoRes.data.items[0].liveStreamingDetails.concurrentViewers || "0");
        }
      }

      res.json(stats);
    } catch (error: any) {
      console.error("YouTube API Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Erro ao buscar dados do YouTube" });
    }
  });

  // API Routes
  app.get("/api/stats", (req, res) => {
    res.json(streamStats);
  });

  app.post("/api/settings", express.json(), (req, res) => {
    streamStats = { ...streamStats, ...req.body };
    io.emit("stats:update", streamStats);
    res.json({ success: true, stats: streamStats });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
