export type PlatformType = 'twitch' | 'youtube' | 'kick' | 'tiktok' | 'x' | 'rtmp' | 'manual';

export interface PlatformConnection {
  id: string;
  type: PlatformType;
  name: string;
  username: string;
  avatar?: string;
  status: 'connected' | 'error' | 'pending';
  stats: {
    viewers: number;
    followers: number;
    isLive: boolean;
  };
}

export interface StreamStats {
  totalViewers: number;
  totalFollowers: number;
  uptime: string;
  activePlatforms: number;
  title: string;
}

export interface ChatMessage {
  id: string;
  platform: PlatformType;
  user: string;
  text: string;
  timestamp: string;
  color: string;
}
