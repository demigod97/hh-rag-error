import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

export type Settings = {
  chatUrl: string;
  ingestUrl: string;
  templateUrl: string;
  openaiKey: string;
  ollamaUrl: string;
  llmProvider: 'OPENAI' | 'OLLAMA';
  googleProjectId: string;
  googleMapsKey: string;
  googleOAuthClientId: string;
  supabaseUrl: string;
  supabaseKey: string;
  n8nBaseUrl: string;
  n8nApiKey: string;
};

// Default settings from environment variables
const defaultSettings: Settings = {
  chatUrl: import.meta.env.VITE_N8N_CHAT_WEBHOOK || '',
  ingestUrl: import.meta.env.VITE_N8N_INGEST_URL || '',
  templateUrl: import.meta.env.VITE_N8N_TEMPLATE_URL || '',
  openaiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  ollamaUrl: import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434',
  llmProvider: (import.meta.env.VITE_LLM_PROVIDER as 'OPENAI' | 'OLLAMA') || 'OPENAI',
  googleProjectId: import.meta.env.VITE_GOOGLE_PROJECT_ID || '',
  googleMapsKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
  googleOAuthClientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  n8nBaseUrl: import.meta.env.VITE_N8N_BASE_URL || '',
  n8nApiKey: import.meta.env.VITE_N8N_API_KEY || '',
};

export function getSettings(): Settings {
  try {
    const stored = localStorage.getItem('hhlmSettings');
    const storedSettings = stored ? JSON.parse(stored) : {};
    return { ...defaultSettings, ...storedSettings };
  } catch (error) {
    console.error('Failed to parse stored settings:', error);
    return defaultSettings;
  }
}

export function setSettings(partialSettings: Partial<Settings>): void {
  const currentSettings = getSettings();
  const newSettings = { ...currentSettings, ...partialSettings };
  localStorage.setItem('hhlmSettings', JSON.stringify(newSettings));
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettingsState] = useState<Settings>(getSettings);

  useEffect(() => {
    // Load settings on mount
    setSettingsState(getSettings());
  }, []);

  const updateSettings = (partialSettings: Partial<Settings>) => {
    setSettings(partialSettings);
    setSettingsState(getSettings());
  };

  const resetSettings = () => {
    localStorage.removeItem('hhlmSettings');
    setSettingsState(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}