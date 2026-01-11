
export enum AssistantState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  LISTENING = 'LISTENING',
  SPEAKING = 'SPEAKING',
  THINKING = 'THINKING',
  OBSERVING = 'OBSERVING',
  ERROR = 'ERROR'
}

export type DeviceType = 'wear' | 'mobile' | 'desktop' | 'tv' | 'auto';

export type UITheme = 'cosmic' | 'emerald' | 'ruby' | 'obsidian';
export type PersonalityType = 'professional' | 'friendly' | 'witty' | 'minimalist' | 'alluring' | 'custom';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SensorData {
  battery?: number;
  charging?: boolean;
  online: boolean;
  platform: string;
  location?: { lat: number; lng: number };
}

export interface TranscriptionEntry {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
  isStreaming?: boolean;
  sources?: GroundingSource[];
}

export interface MemoryEntry {
  id: string;
  fact: string;
  timestamp: Date;
}

// Fixed: Added GeneratedAsset interface required by CreationStudio.tsx
export interface GeneratedAsset {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  timestamp: Date;
}

export interface UserPreferences {
  theme: UITheme;
  personality: PersonalityType;
  customPersonality?: string;
  layout: 'left' | 'right';
  voiceId: string;
  assistantName: string;
  assistantProfilePic?: string; 
}

export interface AuthUser {
  username: string;
  preferences: UserPreferences;
}
