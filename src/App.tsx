import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Activity, 
  Settings, 
  Users, 
  Radio, 
  ArrowUpRight, 
  Clock, 
  Cpu, 
  Send,
  MoreVertical,
  Bell,
  LayoutDashboard,
  LogOut,
  Twitch,
  Plus,
  Youtube,
  Twitter,
  Globe,
  Trash2,
  AlertCircle,
  Monitor,
  Settings2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Play,
  Square,
  Aperture,
  Link2,
  FileText,
  History,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Palette,
  ChevronRight,
  Heart,
  DollarSign,
  Gift,
  UserPlus,
  Volume2,
  VolumeX,
  MessageCircle,
  GraduationCap,
  BookOpen,
  Terminal,
  Layers,
  ArrowDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { io, Socket } from "socket.io-client";
import * as tmi from "tmi.js";
import { cn } from "./lib/utils";
import { StreamStats, ChatMessage, PlatformConnection, PlatformType } from "./types";
import { OBSRemoteControl } from "./components/OBSRemoteControl";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  User
} from "./lib/firebase";

import { KickIcon, TikTokIcon, OBSIcon } from "./constants.tsx";

// Socket connection
let socket: Socket;

export interface StreamEvent {
  id: string;
  platform: PlatformType;
  type: 'follow' | 'sub' | 'donation' | 'cheer';
  user: string;
  timestamp: string;
  details: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const activeTheme = {
    primary: "#06b6d4",
    secondary: "#0891b2",
    name: "Cyan"
  };
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "settings" | "obs" | "connections">("dashboard");
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isConnectingYt, setIsConnectingYt] = useState(false);
  const [addConnError, setAddConnError] = useState<string | null>(null);

  // New States for configuring custom/manual integrations (Kick, TikTok, X, etc.)
  const [configuringPlatform, setConfiguringPlatform] = useState<PlatformType | null>(null);
  const [customUsername, setCustomUsername] = useState("");
  const [customDisplayName, setCustomDisplayName] = useState("");
  const [rtmpUrl, setRtmpUrl] = useState("");
  const [streamKey, setStreamKey] = useState("");

  // Integration States
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => (localStorage.getItem("streamcontrol_alert_sound") || localStorage.getItem("livedeck_alert_sound")) !== "false");
  const [currentAlert, setCurrentAlert] = useState<StreamEvent | null>(null);

  const [events, setEvents] = useState<StreamEvent[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const tmiClients = useRef<{ [key: string]: tmi.Client }>({});

  const stats: StreamStats = {
    totalViewers: connections.reduce((acc, curr) => acc + curr.stats.viewers, 0),
    totalFollowers: connections.reduce((acc, curr) => acc + curr.stats.followers, 0),
    uptime: connections.some(c => c.stats.isLive) ? "02:14:05" : "Offline",
    activePlatforms: connections.filter(c => c.stats.isLive).length,
    title: connections[0]?.name || "Nenhuma live ativa",
  };

  useEffect(() => {
    socket = io();
    
    // Firebase Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      if (firebaseUser) {
        // Sync connections from Firestore
        const connectionsRef = collection(db, "users", firebaseUser.uid, "connections");
        const unsubscribeConnections = onSnapshot(connectionsRef, (snapshot) => {
          const conns = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PlatformConnection));
          setConnections(conns);
        });
        return () => unsubscribeConnections();
      } else {
        // Fallback to localStorage if not logged in
        const saved = localStorage.getItem("stream_connections");
        if (saved) {
          try {
            setConnections(JSON.parse(saved));
          } catch (e) {
            console.error("Error parsing saved connections", e);
          }
        }
      }
    });

    return () => { 
      socket.disconnect();
      unsubscribeAuth();
    };
  }, []);

  // Sync connections with TMI for Twitch
  useEffect(() => {
    connections.forEach(conn => {
      if (conn.type === 'twitch' && !tmiClients.current[conn.id]) {
        const client = new tmi.Client({ channels: [conn.username] });
        client.connect().catch(console.error);
        client.on("message", (channel, tags, message) => {
          const newMessage: ChatMessage = {
            id: tags.id || Date.now().toString(),
            platform: 'twitch',
            user: tags["display-name"] || tags.username || "Anônimo",
            text: message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            color: tags.color || "#FF0080",
          };
          setMessages(prev => [...prev, newMessage].slice(-100));
        });
        tmiClients.current[conn.id] = client;
      }
    });

    // Cleanup removed connections
    Object.keys(tmiClients.current).forEach(id => {
      if (!connections.find(c => c.id === id)) {
        tmiClients.current[id].disconnect();
        delete tmiClients.current[id];
      }
    });

    localStorage.setItem("stream_connections", JSON.stringify(connections));
  }, [connections]);

  // Periodic stats refresh
  useEffect(() => {
    const refreshAllStats = async () => {
      const updatedConnections = await Promise.all(connections.map(async (conn) => {
        if (conn.type === 'youtube') {
          try {
            const res = await fetch(`/api/youtube/stats?username=${conn.username}`);
            if (res.ok) {
              const data = await res.json();
              return {
                ...conn,
                stats: {
                  viewers: data.concurrentViewers || 0,
                  followers: data.subscribers || 0,
                  isLive: data.isLive || false
                }
              };
            }
          } catch (err) {
            console.error(`Error fetching YouTube stats for ${conn.username}:`, err);
          }
        }
        if (conn.type === 'twitch') {
          try {
            const tokenParam = conn.token ? `&token=${conn.token}` : "";
            const res = await fetch(`/api/twitch/stats?userId=${conn.id}&username=${conn.username}${tokenParam}`);
            if (res.ok) {
              const data = await res.json();
              return {
                ...conn,
                stats: {
                  viewers: data.viewers || 0,
                  followers: data.followers || 0,
                  isLive: data.isLive || false
                }
              };
            }
          } catch (err) {
            console.error(`Error fetching Twitch stats for ${conn.username}:`, err);
          }
        }
        // Add other platforms here as they are implemented
        return conn;
      }));

      // Only update if there are actual changes to avoid infinite loop / unnecessary renders
      if (JSON.stringify(updatedConnections) !== JSON.stringify(connections)) {
        setConnections(updatedConnections);
      }
    };

    const interval = setInterval(refreshAllStats, 60000); // Every 60s
    refreshAllStats(); // Initial fetch

    return () => clearInterval(interval);
  }, [connections]);

  // Unified Chat simulation for connected platforms
  useEffect(() => {
    const activePlatforms = connections.filter(c => c.stats.isLive);
    if (activePlatforms.length === 0) return;

    const chatInterval = setInterval(() => {
      // Pick a random connected platform
      const targetPlatform = activePlatforms[Math.floor(Math.random() * activePlatforms.length)];
      
      const platformChatDict: { [key: string]: { users: string[], messages: string[], colors: string[] } } = {
        twitch: {
          users: ['Bruninho_FPS', 'LeticiaGo', 'KickerExtreme', 'Spectator90'],
          messages: ['GOGOGO LIVE INCRÍVEL! 🔥', 'Manda um salve pra galera de SP', 'Que jogada linda mano!', 'A qualidade de imagem tá animal'],
          colors: ['#A970FF', '#FF007F', '#00FFFF', '#FFD700']
        },
        youtube: {
          users: ['VlogsDoCanal', 'Nath_Gamer', 'DaniloTube', 'Mestre_Gamer'],
          messages: ['Gostei do conteúdo, deixei o like!', 'Faz um tour pelo setup depois!', 'YouTube na área, tamo junto!', 'Super Chat enviado! 🚀'],
          colors: ['#FF0000', '#FF4500', '#FF8C00', '#FF1493']
        },
        kick: {
          users: ['KickFanatic_9', 'Verde_Kick', 'LoucoPorGames', 'StreamerPro'],
          messages: ['KICK tá rodando lisinho hoje! 🟢', 'Nova plataforma, curti muito!', 'Manda salve!', 'W live bro!'],
          colors: ['#53FC18', '#00FF7F', '#32CD32', '#7FFF00']
        },
        tiktok: {
          users: ['ClarissaTiktok', 'Vral_Dances', 'Tio_Tok', 'TiktokCoder'],
          messages: ['Enviou um Presente de Rosa! 🌹', 'Apareceu na minha For You page!', 'Top demais essa live multistream!', 'Lindo demais seu app'],
          colors: ['#FE2C55', '#25F4EE', '#EE82EE', '#FF69B4']
        },
        x: {
          users: ['TechStream_X', 'XGamer_Official', 'Elon_Follower', 'NoticiasLive'],
          messages: ['Retuitei o link da transmissão! 🐦', 'Notificação enviada direto do feed do X!', 'Gostei muito da novidade', 'W deck!'],
          colors: ['#FFFFFF', '#D3D3D3', '#808080', '#A9A9A9']
        }
      };

      const customData = platformChatDict[targetPlatform.type] || platformChatDict.twitch;
      const randomUser = customData.users[Math.floor(Math.random() * customData.users.length)];
      const randomMsgStr = customData.messages[Math.floor(Math.random() * customData.messages.length)];
      const randomColor = customData.colors[Math.floor(Math.random() * customData.colors.length)];

      const newSimulatedMsg: ChatMessage = {
        id: 'sim_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
        platform: targetPlatform.type,
        user: randomUser,
        text: randomMsgStr,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        color: randomColor
      };

      setMessages(prev => [...prev, newSimulatedMsg].slice(-100));
    }, Math.floor(Math.random() * 5000) + 4000); // Between 4 to 9 seconds

    return () => clearInterval(chatInterval);
  }, [connections]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleOAuthConnect = async (platform: PlatformType) => {
    setAddConnError(null);
    let urlEndpoint = "";
    
    if (platform === 'twitch') {
      urlEndpoint = "/api/auth/twitch/url";
    } else if (platform === 'youtube') {
      urlEndpoint = "/api/auth/youtube/url";
    } else if (platform === 'kick') {
      urlEndpoint = "/api/auth/kick/url";
    } else if (platform === 'tiktok') {
      urlEndpoint = "/api/auth/tiktok/url";
    } else if (platform === 'x') {
      urlEndpoint = "/api/auth/x/url";
    } else {
      return;
    }

    try {
      const res = await fetch(urlEndpoint);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Erro ao obter URL de autenticação para ${platform}`);
      }
      const { url } = await res.json();
      const authWindow = window.open(url, `${platform}Auth`, "width=550,height=680");

      if (!authWindow) {
        throw new Error("O navegador bloqueou a janela pop-up de autorização. Por favor, libere pop-ups para este site.");
      }

      const handleMessage = async (event: MessageEvent) => {
        const type = event.data?.type;
        if (
          (platform === 'twitch' && type === 'OAUTH_AUTH_SUCCESS') ||
          (platform === 'youtube' && type === 'YOUTUBE_AUTH_SUCCESS') ||
          (platform === 'kick' && type === 'KICK_AUTH_SUCCESS') ||
          (platform === 'tiktok' && type === 'TIKTOK_AUTH_SUCCESS') ||
          (platform === 'x' && type === 'X_AUTH_SUCCESS')
        ) {
          let newUser: PlatformConnection;
          
          if (platform === 'twitch') {
            newUser = {
              id: event.data.user.id,
              type: 'twitch',
              name: event.data.user.display_name,
              username: event.data.user.login,
              avatar: event.data.user.profile_image_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.data.user.login}`,
              status: 'connected',
              token: event.data.token,
              stats: { viewers: 0, followers: 0, isLive: false }
            };
          } else if (platform === 'youtube') {
            const channel = event.data.channel;
            newUser = {
              id: channel.id,
              type: 'youtube',
              name: channel.snippet?.title || "Canal YouTube",
              username: channel.snippet?.customUrl || channel.id,
              avatar: channel.snippet?.thumbnails?.default?.url || `https://api.dicebear.com/7.x/identicon/svg?seed=${channel.id}`,
              status: 'connected',
              stats: { 
                viewers: 0, 
                followers: parseInt(channel.statistics?.subscriberCount || "0") || 0, 
                isLive: false 
              }
            };
          } else {
            const userObj = event.data.user;
            newUser = {
              id: userObj.id,
              type: platform,
              name: userObj.display_name,
              username: userObj.username,
              avatar: userObj.profile_image_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${userObj.username}`,
              status: 'connected',
              stats: {
                viewers: 0,
                followers: 0,
                isLive: false
              }
            };
          }

          if (user) {
            const { doc, setDoc } = await import("firebase/firestore");
            await setDoc(doc(db, "users", user.uid, "connections", newUser.id), newUser);
          } else {
            setConnections(prev => {
              const updated = [...prev.filter(c => c.id !== newUser.id), newUser];
              localStorage.setItem("stream_connections", JSON.stringify(updated));
              return updated;
            });
          }
          
          setShowAddModal(false);
          window.removeEventListener('message', handleMessage);
        }
      };
      
      window.addEventListener('message', handleMessage);
    } catch (err: any) {
      console.error(`Erro ao conectar ${platform}:`, err);
      setAddConnError(err.message || `Erro ao conectar com ${platform}`);
    }
  };

  const addManualConnection = async (type: PlatformType, defaultName: string) => {
    const finalName = customDisplayName.trim() || defaultName;
    const finalUsername = customUsername.trim() || (user?.displayName || "user").toLowerCase().replace(/\s/g, '');
    
    const newConn: PlatformConnection = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name: finalName,
      username: finalUsername,
      status: 'connected',
      stats: { viewers: 0, followers: 0, isLive: false }
    };
    
    // If RTMP and Stream key details are provided, append
    if (rtmpUrl.trim() || streamKey.trim()) {
      (newConn as any).rtmpUrl = rtmpUrl.trim();
      (newConn as any).streamKey = streamKey.trim();
    }
    
    if (user) {
      await setDoc(doc(db, "users", user.uid, "connections", newConn.id), newConn);
    } else {
      const updated = [...connections, newConn];
      setConnections(updated);
      localStorage.setItem("stream_connections", JSON.stringify(updated));
    }

    // Reset setup states
    setConfiguringPlatform(null);
    setCustomUsername("");
    setCustomDisplayName("");
    setRtmpUrl("");
    setStreamKey("");
    setShowAddModal(false);
  };

  const removeConnection = async (id: string) => {
    if (user) {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "users", user.uid, "connections", id));
    } else {
      setConnections(prev => prev.filter(c => c.id !== id));
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    // Mock sending to all connected platforms
    const mockMsg: ChatMessage = {
      id: Date.now().toString(),
      platform: 'manual',
      user: "Você",
      text: inputMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      color: "#FFFFFF",
    };
    setMessages(prev => [...prev, mockMsg]);
    setInputMessage("");
  };

  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      
      // Chime synthesis
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 notch
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 notch
      
      gainNode.gain.setValueAtTime(0.0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 1.2);
      osc2.stop(audioCtx.currentTime + 1.2);
    } catch (err) {
      console.warn("Audio Context failure: ", err);
    }
  };

  const simulateAlertEvent = async (type: 'follow' | 'sub' | 'donation' | 'cheer', customUser?: string) => {
    const randomUsers = ['Tarik_Dev', 'Gabs_Stramer', 'GamerElite', 'Lia_Twitches', 'Vini_Multistream', 'Cynthia_Kick', 'X_Rider'];
    const selectedUser = customUser || randomUsers[Math.floor(Math.random() * randomUsers.length)];
    const activePlatformList: PlatformType[] = connections.length > 0 ? connections.map(c => c.type) : ['twitch', 'kick'];
    const selectedPlatform = activePlatformList[Math.floor(Math.random() * activePlatformList.length)];
    
    let detailsText = '';

    if (type === 'follow') {
      detailsText = "Passou a seguir o seu canal!";
    } else if (type === 'sub') {
      const tiers = ['Nível 1', 'Nível 2', 'Nível 3', 'Prime'];
      const pickedTier = tiers[Math.floor(Math.random() * tiers.length)];
      detailsText = `Inscrito via ${pickedTier} ou presenteado!`;
    } else if (type === 'donation') {
      const values = [5, 10, 20, 50, 100];
      const val = values[Math.floor(Math.random() * values.length)];
      const messagesQuote = [
        "Amei sua gameplay!",
        "Live incrível, joga muito!",
        "Manda um abraço para a minha mãe!",
        "Estou curtindo muito a gameplay de OBS hoje."
      ];
      const chosenQuote = messagesQuote[Math.floor(Math.random() * messagesQuote.length)];
      detailsText = `Enviou uma Doação de R$ ${val.toFixed(2)} - "${chosenQuote}"`;
    } else if (type === 'cheer') {
      const bitQty = [100, 500, 1000, 5000];
      const bOption = bitQty[Math.floor(Math.random() * bitQty.length)];
      detailsText = `Animou a live com Cheer de ${bOption} Bits!`;
    }

    const newEvent: StreamEvent = {
      id: Math.random().toString(36).substr(2, 9),
      platform: selectedPlatform,
      type,
      user: selectedUser,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      details: detailsText
    };

    // Update state to append
    setEvents(prev => [newEvent, ...prev].slice(0, 50));
    setCurrentAlert(newEvent);
    playAlertSound();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090A0F] flex flex-col items-center justify-center space-y-4">
        <Radio className="w-12 h-12 text-cyan-400 animate-pulse" />
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 animate-pulse">Iniciando Stream Control...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090A0F] text-white font-sans theme-selection overflow-hidden flex flex-col">
      {/* Dynamic Overlay Alert Banner */}
      <AnimatePresence>
        {currentAlert && (
          <motion.div
            initial={{ opacity: 0, y: -85, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -45, scale: 0.9 }}
            onAnimationComplete={() => {
              setTimeout(() => setCurrentAlert(null), 3800);
            }}
            className="fixed top-6 left-4 right-4 z-50 max-w-sm mx-auto pointer-events-none"
          >
            <div className="relative overflow-hidden bg-[#121319] border border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-xl">
              <div className="relative flex items-center gap-3.5 z-10">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  {currentAlert.type === 'follow' && <Heart className="w-5 h-5 text-emerald-400" />}
                  {currentAlert.type === 'sub' && <Gift className="w-5 h-5 text-cyan-400" />}
                  {currentAlert.type === 'donation' && <DollarSign className="w-5 h-5 text-amber-400" />}
                  {currentAlert.type === 'cheer' && <Bell className="w-5 h-5 text-sky-400" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                      {currentAlert.type === 'follow' && 'Novo Seguidor!'}
                      {currentAlert.type === 'sub' && 'Nova Inscrição!'}
                      {currentAlert.type === 'donation' && 'Super Chat Doação!'}
                      {currentAlert.type === 'cheer' && 'Bits Cheer!'}
                    </span>
                    <PlatformBadge type={currentAlert.platform} />
                  </div>
                  <h4 className="text-sm font-bold text-white truncate mt-0.5">{currentAlert.user}</h4>
                  <p className="text-[10px] text-neutral-400 font-medium truncate mt-0.5 leading-snug">{currentAlert.details}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        :root {
          --primary-accent: ${activeTheme.primary};
          --secondary-accent: ${activeTheme.secondary};
        }
        .text-theme-primary { color: ${activeTheme.primary} !important; }
        .bg-theme-primary { background-color: ${activeTheme.primary} !important; }
        .bg-theme-primary-subtle { background-color: ${activeTheme.primary}1a !important; }
        .border-theme-primary { border-color: ${activeTheme.primary} !important; }
        .theme-btn-gradient { background-color: ${activeTheme.primary} !important; }
        .theme-selection::selection { background-color: ${activeTheme.primary}4d !important; }
        .theme-focus:focus { border-color: ${activeTheme.primary} !important; box-shadow: 0 0 8px ${activeTheme.primary}40 !important; }
      `}</style>
      
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#0C0D12] z-10">
        <div className="flex items-center gap-3">
          <Radio className="w-6 h-6 text-cyan-400" />
          <div>
            <h1 className="text-sm font-black tracking-tight flex items-center gap-2 text-white">
              Stream Control
              <span className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase bg-neutral-800 border border-neutral-700 text-neutral-400">
                LITE
              </span>
            </h1>
            <div className="flex items-center gap-2">
              <span className={cn("w-1.5 h-1.5 rounded-full", stats.activePlatforms > 0 ? "bg-red-500 animate-pulse" : "bg-neutral-600")} />
              <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-medium">
                {stats.activePlatforms > 0 ? `${stats.activePlatforms} Ativos` : "Offline"}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setActiveTab("connections")}
          className={cn(
            "p-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer",
            activeTab === "connections" ? "bg-theme-primary/10 border-theme-primary/30 text-theme-primary" : "bg-[#1A1A1A] border-[#262626] text-[#8E8E8E]"
          )}
          title="Gerenciar Conexões & Canais"
        >
          <div className="relative">
            <Link2 className="w-5 h-5" />
          </div>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 space-y-6"
            >
              {/* Aggregated Stats */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard 
                  label="Espectadores Totais" 
                  value={stats.totalViewers.toLocaleString()} 
                  icon={<Users className="w-4 h-4" />}
                  color="text-emerald-400"
                />
                <StatCard 
                  label="Tempo Online" 
                  value={stats.uptime} 
                  icon={<Clock className="w-4 h-4" />}
                  color="text-theme-primary"
                />
                <StatCard 
                  label="Seguidores" 
                  value={stats.totalFollowers.toLocaleString()} 
                  icon={<ArrowUpRight className="w-4 h-4" />}
                  color="text-sky-400"
                />
                <StatCard 
                  label="Plataformas" 
                  value={`${stats.activePlatforms}/${connections.length}`} 
                  icon={<Globe className="w-4 h-4" />}
                  color="text-amber-400"
                />
              </div>

              {/* Connected Platforms List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E8E8E]">Fontes Ativas</h3>
                <div className="space-y-2">
                  {connections.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-[#262626] rounded-2xl text-center space-y-3">
                      <AlertCircle className="w-8 h-8 text-[#444] mx-auto" />
                      <p className="text-xs text-[#8E8E8E]">Nenhuma conta conectada ainda.</p>
                      <button 
                        onClick={() => setActiveTab("connections")}
                        className="text-xs font-bold text-theme-primary uppercase"
                      >
                        Conectar Agora
                      </button>
                    </div>
                  ) : (
                    connections.map(conn => (
                      <PlatformItem key={conn.id} connection={conn} onRemove={() => { removeConnection(conn.id); }} />
                    ))
                  )}
                </div>
              </div>

              {/* Global Feed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E8E8E] flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-theme-primary animate-pulse" />
                    Feed Multistream Unificado
                  </h3>
                  
                  {/* Sound mute toggle & controller panel button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const next = !soundEnabled;
                        setSoundEnabled(next);
                        localStorage.setItem("streamcontrol_alert_sound", String(next));
                      }}
                      className={cn(
                        "p-1.5 rounded-lg border text-xs flex items-center justify-center transition-all cursor-pointer",
                        soundEnabled ? "bg-theme-primary/10 border-theme-primary/30 text-theme-primary" : "bg-neutral-900 border-neutral-800 text-neutral-500"
                      )}
                      title={soundEnabled ? "Sons de Alerta: Ativados" : "Sons de Alerta: Mutados"}
                    >
                      {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Scrolling Active Feed Events with Animation */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-none">
                  <AnimatePresence initial={false}>
                    {events.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-[#151619] border border-[#262626] rounded-2xl p-4 flex flex-col items-center justify-center py-10 opacity-50"
                      >
                        <Activity className="w-10 h-10 mb-2 text-[#444]" />
                        <p className="text-xs text-neutral-500">Nenhum evento registrado ainda.</p>
                      </motion.div>
                    ) : (
                      events.map((event) => {
                        let iconNode = <Heart className="w-4 h-4 text-emerald-400" />;
                        let cardBorder = "border-[#262626]/40";
                        if (event.type === 'sub') {
                          iconNode = <Gift className="w-4 h-4 text-theme-primary" />;
                        } else if (event.type === 'donation') {
                          iconNode = <DollarSign className="w-4 h-4 text-amber-400" />;
                          cardBorder = "border-amber-500/20";
                        } else if (event.type === 'cheer') {
                          iconNode = <Bell className="w-4 h-4 text-sky-450" />;
                        }
                        
                        return (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 450, damping: 30 }}
                            className={cn(
                              "bg-[#151619] border p-3 rounded-2xl flex items-center justify-between gap-3 overflow-hidden",
                              cardBorder
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                                {iconNode}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-neutral-100 truncate">{event.user}</span>
                                  <PlatformBadge type={event.platform} />
                                </div>
                                <p className="text-[10px] text-[#A8A8A8] mt-0.5 leading-tight truncate">{event.details}</p>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono text-[#5E5E5E] shrink-0 font-semibold">{event.timestamp}</span>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col h-full bg-[#050505]"
            >
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-[#444] space-y-2">
                    <MessageSquare className="w-8 h-8 opacity-20" />
                    <p className="text-xs font-medium">Nenhuma mensagem interceptada...</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className="text-sm flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <PlatformBadge type={msg.platform} />
                      <span className="text-[10px] text-[#555] font-mono">{msg.timestamp}</span>
                      <span className="font-bold" style={{ color: msg.color }}>{msg.user}:</span>
                    </div>
                    <p className="text-[#D1D1D1] bg-[#1A1A1A]/80 self-start px-3 py-2 rounded-2xl rounded-tl-none border border-[#262626]/30">
                      {msg.text}
                    </p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              
              <div className="p-4 bg-[#0A0A0A] border-t border-[#262626]">
                <form onSubmit={sendMessage} className="relative">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Responder para todas..."
                    className="w-full bg-[#111118] border border-white/5 rounded-xl py-3 px-4 pr-12 text-sm focus:outline-none theme-focus transition-colors"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 theme-btn-gradient rounded-lg text-white disabled:opacity-30"
                    disabled={!inputMessage.trim() || connections.length === 0}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === "connections" && (
            <motion.div
              key="connections"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="p-6 space-y-6"
            >
              {/* Header de Conexões */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-bold text-white">Canais de Transmissão</h2>
                  <p className="text-xs text-neutral-500 font-medium font-sans">Controle suas transmissões simultâneas de onde estiver</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="p-2.5 rounded-xl theme-btn-gradient text-white flex items-center gap-1.5 text-xs font-bold uppercase cursor-pointer transition-all active:scale-95 shadow-md shadow-theme-primary/10"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Conectar</span>
                </button>
              </div>

              {/* Lista de Conexões */}
              <div className="space-y-3">
                {connections.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-[#262626] rounded-2xl text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-[#444] mx-auto" />
                    <p className="text-xs text-neutral-400">Nenhum canal conectado ainda. Toque em "Conectar" acima.</p>
                  </div>
                ) : (
                  connections.map(conn => (
                    <div key={conn.id} className="bg-[#121318] border border-[#222] p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center border border-[#262626]">
                          <PlatformIcon type={conn.type} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{conn.name}</p>
                          <p className="text-[10px] text-[#8E8E8E] font-medium uppercase font-mono mt-0.5">{conn.type} • @{conn.username}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeConnection(conn.id)}
                        className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all cursor-pointer"
                        title="Remover conexão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "obs" && (
            <motion.div
              key="obs"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="p-6 space-y-6"
            >
              <OBSRemoteControl />
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="p-6 space-y-6"
            >
              <h2 className="text-xl font-bold text-white">Configurações</h2>
              
              <div className="space-y-4">
                <ToggleItem label="Notificações Globais" active={true} />
                <ToggleItem label="Log de Erros em Tempo Real" active={false} />
                <ToggleItem label="Modo Baixa Latência (Chat)" active={true} />
                <ToggleItem label="Vibrar em Novos Eventos" active={true} />
              </div>

              <div className="pt-10">
                <p className="text-[10px] text-neutral-600 text-center font-mono">APP ID: stream-control-lite</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Platform Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-[#151619] w-full max-w-md rounded-3xl border border-[#262626] overflow-hidden"
            >
              <div className="p-6 border-b border-[#262626] flex items-center justify-between">
                <h3 className="text-lg font-bold">
                  {configuringPlatform 
                    ? `Configurar ${configuringPlatform.toUpperCase()}` 
                    : "Conectar Plataforma"}
                </h3>
                <button onClick={() => {
                  setShowAddModal(false);
                  setAddConnError(null);
                  setConfiguringPlatform(null);
                }} className="text-[#8E8E8E]"><Plus className="rotate-45" /></button>
              </div>
              <div className="p-6 space-y-4">
                {addConnError && (
                  <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-[10px] text-red-500 font-bold uppercase">{addConnError}</p>
                  </div>
                )}
                
                {configuringPlatform ? (
                  /* Form configured layout */
                  <div className="space-y-4 animate-fadeIn">
                    {configuringPlatform !== 'rtmp' && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Usuário / ID do Canal</label>
                          <input
                            type="text"
                            value={customUsername}
                            onChange={(e) => setCustomUsername(e.target.value)}
                            placeholder={configuringPlatform === 'kick' ? "ex: alanzoka" : configuringPlatform === 'tiktok' ? "ex: @tiktokcoder" : "ex: @perfil"}
                            className="w-full bg-[#111118] border border-white/5 rounded-xl p-3 text-xs font-mono text-neutral-300 focus:outline-none focus:border-theme-primary font-sans"
                          />
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Nome de Exibição / Apelido</label>
                          <input
                            type="text"
                            value={customDisplayName}
                            onChange={(e) => setCustomDisplayName(e.target.value)}
                            placeholder={configuringPlatform === 'kick' ? "ex: Alan Kick Live" : configuringPlatform === 'tiktok' ? "ex: TikTok Oficial" : "ex: Meu Perfil X"}
                            className="w-full bg-[#111118] border border-white/5 rounded-xl p-3 text-xs text-neutral-300 focus:outline-none focus:border-theme-primary font-sans"
                          />
                        </div>
                      </>
                    )}

                    {configuringPlatform === 'rtmp' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Nome da Live RTMP</label>
                        <input
                          type="text"
                          value={customDisplayName}
                          onChange={(e) => setCustomDisplayName(e.target.value)}
                          placeholder="ex: Transmissão Secundária"
                          className="w-full bg-[#111118] border border-white/5 rounded-xl p-3 text-xs text-neutral-300 focus:outline-none focus:border-theme-primary font-sans"
                        />
                      </div>
                    )}

                    {/* RTMP specific fields */}
                    {(configuringPlatform === 'rtmp' || configuringPlatform === 'kick' || configuringPlatform === 'tiktok') && (
                      <div className="p-4 bg-neutral-900/40 border border-white/5 rounded-2xl space-y-3 mt-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#5E5E5E] block">
                          Chaves de Multistream (RTMP Opcional)
                        </span>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-neutral-400">Servidor URL (Server URL)</label>
                          <input
                            type="text"
                            value={rtmpUrl}
                            onChange={(e) => setRtmpUrl(e.target.value)}
                            placeholder={configuringPlatform === 'rtmp' ? "rtmp://live.twitch.tv/app/" : "Opcional: rtmp://..."}
                            className="w-full bg-[#09090D] border border-white/5 rounded-xl p-2.5 text-[11px] font-mono text-neutral-400 focus:outline-none focus:border-theme-primary"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-neutral-400">Chave de Stream (Stream Key)</label>
                          <input
                            type="password"
                            value={streamKey}
                            onChange={(e) => setStreamKey(e.target.value)}
                            placeholder="live_..."
                            className="w-full bg-[#09090D] border border-white/5 rounded-xl p-2.5 text-[11px] font-mono text-neutral-400 focus:outline-none focus:border-theme-primary"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-4">
                      <button
                        onClick={() => {
                          setConfiguringPlatform(null);
                          setCustomUsername("");
                          setCustomDisplayName("");
                          setRtmpUrl("");
                          setStreamKey("");
                        }}
                        className="py-3 px-4 rounded-xl border border-white/10 hover:bg-white/5 active:scale-95 text-xs text-center font-bold tracking-widest uppercase transition-all cursor-pointer font-sans"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={() => addManualConnection(configuringPlatform, configuringPlatform === 'rtmp' ? 'Servidor RTMP' : `Canal ${configuringPlatform.toUpperCase()}`)}
                        className="py-3 px-4 rounded-xl bg-theme-primary text-white hover:opacity-90 active:scale-95 text-xs text-center font-bold tracking-widest uppercase transition-all cursor-pointer shadow-[0_12px_24px_-8px_var(--primary-accent)] font-sans"
                      >
                        Conectar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Connection options */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <PlatformSelectButton 
                      icon={<Twitch className="text-[#9146FF]" />} 
                      label="Twitch" 
                      onClick={() => handleOAuthConnect('twitch')} 
                    />
                    <PlatformSelectButton 
                      icon={<KickIcon className="text-[#53FC18]" />} 
                      label="Kick" 
                      onClick={() => setConfiguringPlatform('kick')} 
                    />
                    <PlatformSelectButton 
                      icon={<Radio className="text-amber-400" />} 
                      label="Custom RTMP" 
                      onClick={() => setConfiguringPlatform('rtmp')} 
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-[#262626]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#444] mb-2">Instruções de Configuração</p>
                  <details className="group">
                    <summary className="text-[10px] text-[#8E8E8E] cursor-pointer hover:text-white transition-colors flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Como funciona a conexão integrada?
                    </summary>
                    <div className="mt-2 text-[10px] text-[#555] leading-relaxed space-y-2 bg-[#0A0A0A] p-3 rounded-xl border border-[#262626]">
                      <p><strong className="text-white">Kick e Custom RTMP:</strong> Insira seu nome ou URL do canal e o servidor correspondente. O painel simula a sincronização e logs de multistream ativos em tempo real.</p>
                      <p><strong className="text-white">Twitch:</strong> Utilize a conexão OAuth integrada e segura para autorizar com suas credenciais.</p>
                    </div>
                  </details>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-[#262626] flex items-center justify-around px-2 z-20">
        <NavButton 
          active={activeTab === "dashboard"} 
          onClick={() => setActiveTab("dashboard")} 
          icon={<LayoutDashboard />} 
          label="Painel" 
        />
        <NavButton 
          active={activeTab === "chat"} 
          onClick={() => setActiveTab("chat")} 
          icon={<MessageSquare />} 
          label="Chat" 
        />
        <NavButton 
          active={activeTab === "obs"} 
          onClick={() => setActiveTab("obs")} 
          icon={<OBSIcon size={20} />} 
          label="OBS" 
        />
        <NavButton 
          active={activeTab === "connections"} 
          onClick={() => setActiveTab("connections")} 
          icon={<Link2 />} 
          label="Canais" 
        />
        <NavButton 
          active={activeTab === "settings"} 
          onClick={() => setActiveTab("settings")} 
          icon={<Settings />} 
          label="Config" 
        />
      </nav>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-[#151619] border border-[#262626] p-4 rounded-2xl space-y-2 relative overflow-hidden group active:bg-[#1C1D21] transition-colors">
      <div className={cn("p-1.5 rounded-lg bg-[#1A1A1A] border border-[#262626] w-fit", color)}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E8E]">{label}</p>
        <p className="text-lg font-bold font-mono tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactElement, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 min-w-[70px] relative transition-all duration-300",
        active ? "text-theme-primary" : "text-[#8E8E8E]"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl transition-all duration-300",
        active ? "bg-theme-primary-subtle scale-110" : "bg-transparent"
      )}>
        {React.cloneElement(icon, { className: "w-6 h-6" })}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-pill"
          className="absolute -top-1 w-10 h-1 theme-btn-gradient rounded-full"
        />
      )}
    </button>
  );
}

function PlatformIcon({ type }: { type: PlatformType }) {
  switch (type) {
    case 'twitch': return <Twitch className="w-5 h-5 text-[#9146FF]" />;
    case 'youtube': return <Youtube className="w-5 h-5 text-red-500" />;
    case 'x': return <Twitter className="w-5 h-5 text-white" />;
    case 'kick': return <KickIcon className="w-5 h-5 text-[#53FC18]" />;
    case 'tiktok': return <TikTokIcon className="w-5 h-5 text-white" />;
    case 'rtmp': return <Radio className="w-5 h-5 text-amber-500" />;
    default: return <Globe className="w-5 h-5 text-[#8E8E8E]" />;
  }
}

function PlatformBadge({ type }: { type: PlatformType }) {
  const colors = {
    twitch: 'bg-[#9146FF]/20 text-[#9146FF]',
    youtube: 'bg-red-500/20 text-red-500',
    kick: 'bg-[#53FC18]/20 text-[#53FC18]',
    tiktok: 'bg-white/20 text-white',
    x: 'bg-white/10 text-white',
    rtmp: 'bg-amber-500/20 text-amber-500',
    manual: 'bg-gray-500/20 text-gray-500'
  };
  return (
    <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter", colors[type] || colors.manual)}>
      {type}
    </span>
  );
}

function PlatformItem({ connection, onRemove }: { connection: PlatformConnection, onRemove: () => void, key?: string }) {
  return (
    <div className="bg-[#151619] border border-[#262626] p-4 rounded-2xl flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] border border-[#262626] flex items-center justify-center overflow-hidden">
            {connection.avatar ? (
              <img src={connection.avatar} alt={connection.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <PlatformIcon type={connection.type} />
            )}
          </div>
          <span className={cn("absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#151619]", connection.stats.isLive ? "bg-red-500" : "bg-gray-500")} />
        </div>
        <div>
          <p className="text-sm font-bold">{connection.name || connection.username}</p>
          <div className="flex items-center gap-3 text-[10px] text-[#8E8E8E] font-medium">
             <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{connection.stats.viewers.toLocaleString()}</span>
             <span className="flex items-center gap-1"><ArrowUpRight className="w-2.5 h-2.5" />{connection.stats.followers.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <button onClick={onRemove} className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-[#444] hover:text-red-500">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function PlatformSelectButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  const iconElement = React.isValidElement(icon) 
    ? React.cloneElement(icon as React.ReactElement, { 
        size: 24, 
        className: cn((icon as React.ReactElement).props.className, "transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]") 
      }) 
    : icon;

  return (
    <button 
      id={`platform-select-${label.toLowerCase().replace(/\s/g, '-')}`}
      onClick={onClick}
      className="p-4 bg-[#1A1A1A] border border-[#262626] rounded-2xl flex flex-col items-center gap-2 active:bg-[#222] transition-all hover:border-[#333] active:scale-95 group relative overflow-hidden"
    >
      <div className="p-3 bg-[#0A0A0A] rounded-2xl border border-[#262626] group-hover:border-[#444] transition-colors shadow-inner relative z-10">
        {iconElement}
      </div>
      <span className="text-[10px] font-bold text-[#8E8E8E] group-hover:text-white transition-colors uppercase tracking-widest relative z-10">{label}</span>
      
      {/* Subtle background highlight */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </button>
  );
}

function ToggleItem({ label, active }: { label: string, active: boolean }) {
  const [isOn, setIsOn] = useState(active);
  return (
    <div className="flex items-center justify-between p-4 bg-[#151619] border border-[#262626] rounded-xl">
      <span className="text-sm font-medium">{label}</span>
      <button 
        onClick={() => setIsOn(!isOn)}
        className={cn(
          "w-12 h-6 rounded-full relative transition-colors duration-300",
          isOn ? "bg-theme-primary" : "bg-[#262626]"
        )}
      >
        <div className={cn(
          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
          isOn ? "left-7" : "left-1"
        )} />
      </button>
    </div>
  );
}
