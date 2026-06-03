import React, { useState, useEffect, useRef } from 'react';
import OBSWebSocket from 'obs-websocket-js';
import { 
  Play, 
  Square, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Settings2, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  Monitor
} from "lucide-react";
import { OBSIcon } from '../constants';
import { cn } from "../lib/utils";

export function OBSRemoteControl() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState({
    address: 'localhost:4455',
    password: ''
  });
  const [showSettings, setShowSettings] = useState(false);
  const [obsStats, setObsStats] = useState({
    isStreaming: false,
    isRecording: false,
    currentScene: '',
    scenes: [] as string[],
    micMuted: false
  });

  const obs = useRef<OBSWebSocket | null>(null);

  const connectOBS = async () => {
    if (obs.current) {
        await obs.current.disconnect();
    }
    
    obs.current = new OBSWebSocket();
    try {
      setError(null);
      await obs.current.connect(`ws://${config.address}`, config.password);
      setConnected(true);
      fetchInitialState();
      
      // Event listeners
      obs.current.on('StreamStateChanged', (data) => {
        setObsStats(prev => ({ ...prev, isStreaming: data.outputActive }));
      });
      obs.current.on('RecordStateChanged', (data) => {
        setObsStats(prev => ({ ...prev, isRecording: data.outputActive }));
      });
      obs.current.on('CurrentProgramSceneChanged', (data) => {
        setObsStats(prev => ({ ...prev, currentScene: data.sceneName }));
      });
    } catch (err: any) {
      setError('Erro de conexão: ' + (err.message || 'Verifique se o OBS WebSocket está ativo.'));
      setConnected(false);
    }
  };

  const fetchInitialState = async () => {
    if (!obs.current) return;
    try {
      const streamStatus = await obs.current.call('GetStreamStatus');
      const recordStatus = await obs.current.call('GetRecordStatus');
      const sceneList = await obs.current.call('GetSceneList');
      
      setObsStats({
        isStreaming: streamStatus.outputActive,
        isRecording: recordStatus.outputActive,
        currentScene: sceneList.currentProgramSceneName,
        scenes: sceneList.scenes.map((s: any) => s.sceneName),
        micMuted: false // Simplified
      });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStream = () => obs.current?.call('ToggleStream');
  const toggleRecord = () => obs.current?.call('ToggleRecord');
  const switchScene = (sceneName: string) => obs.current?.call('SetCurrentProgramScene', { sceneName });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <OBSIcon className="w-5 h-5 text-cyan-400" />
          Controle OBS
        </h2>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={cn("p-2 rounded-xl border transition-colors", showSettings ? "bg-cyan-500 border-transparent text-white" : "bg-[#1A1A1A] border-[#262626]")}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {showSettings && (
        <div className="bg-[#151619] border border-[#262626] p-4 rounded-2xl space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-[#8E8E8E]">Endereço (IP:Porta)</label>
            <input 
              type="text" 
              value={config.address}
              onChange={(e) => setConfig(prev => ({ ...prev, address: e.target.value }))}
              placeholder="ex: 192.168.1.5:4455"
              className="w-full bg-[#111118] border border-white/5 rounded-xl p-3 text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-[#8E8E8E]">Senha do WebSocket</label>
            <input 
              type="password" 
              value={config.password}
              onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
              className="w-full bg-[#111118] border border-white/5 rounded-xl p-3 text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button 
            onClick={connectOBS}
            className="w-full py-3 bg-cyan-500 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:bg-cyan-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Conectar ao OBS
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500" />
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {connected ? (
        <div className="space-y-6">
          {/* Main Controls */}
          <div className="grid grid-cols-2 gap-4">
            <ControlCard 
              label="TRANSMISSÃO" 
              active={obsStats.isStreaming} 
              icon={<Video className="w-6 h-6" />}
              activeColor="bg-red-500"
              onClick={toggleStream}
            />
            <ControlCard 
              label="GRAVAÇÃO" 
              active={obsStats.isRecording} 
              icon={<Play className="w-6 h-6" />}
              activeColor="bg-amber-500"
              onClick={toggleRecord}
            />
          </div>

          {/* Scenes */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E8E]">Cenas</h3>
            <div className="grid grid-cols-2 gap-2">
              {obsStats.scenes.map(scene => (
                <button
                  key={scene}
                  onClick={() => switchScene(scene)}
                  className={cn(
                    "p-4 rounded-xl text-left border transition-all",
                    obsStats.currentScene === scene 
                      ? "bg-cyan-500/10 border-cyan-500 text-cyan-400" 
                      : "bg-[#151619] border-[#262626] text-[#8E8E8E]"
                  )}
                >
                  <p className="text-sm font-bold truncate">{scene}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {!showSettings && (
            <div className="py-12 text-center space-y-6">
              <div className="flex flex-col items-center gap-4">
                <OBSIcon className="w-16 h-16 mx-auto text-[#262626]" />
                <div className="space-y-1">
                  <p className="text-lg font-bold">OBS não conectado</p>
                  <p className="text-xs text-[#8E8E8E]">Clique na engrenagem acima para configurar seu servidor.</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#1A1A1A] border border-[#262626] p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Como conectar ao OBS:</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#262626] flex-shrink-0 flex items-center justify-center text-[10px] font-bold">1</div>
                <p className="text-xs text-[#8E8E8E] leading-relaxed">No OBS Studio, vá em <span className="text-white">Ferramentas</span> &gt; <span className="text-white">Configurações do Servidor WebSocket</span>.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#262626] flex-shrink-0 flex items-center justify-center text-[10px] font-bold">2</div>
                <p className="text-xs text-[#8E8E8E] leading-relaxed">Marque <span className="text-white">Habilitar Servidor WebSocket</span>.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#262626] flex-shrink-0 flex items-center justify-center text-[10px] font-bold">3</div>
                <p className="text-xs text-[#8E8E8E] leading-relaxed">Clique em <span className="text-white">Mostrar Informações de Conexão</span> para ver o IP, Porta e a Senha.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#262626] flex-shrink-0 flex items-center justify-center text-[10px] font-bold">4</div>
                <p className="text-xs text-[#8E8E8E] leading-relaxed">Insira esses dados aqui clicando no ícone de <span className="text-white">Configurações</span> no topo desta tela.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlCard({ label, active, icon, activeColor, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "aspect-square rounded-3xl border flex flex-col items-center justify-center gap-3 transition-all active:scale-95",
        active ? `${activeColor} border-transparent text-white shadow-lg` : "bg-[#151619] border-[#262626] text-[#8E8E8E]"
      )}
    >
      {active ? <Square className="w-6 h-6" /> : icon}
      <span className="text-[10px] font-bold tracking-widest uppercase">{active ? 'PARAR' : 'INICIAR'} {label}</span>
      {active && <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-white animate-pulse" />}
    </button>
  );
}
