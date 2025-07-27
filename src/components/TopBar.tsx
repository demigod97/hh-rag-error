import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, Bell, User, Trash2, Settings, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HistoryDrawer } from "./HistoryDrawer";
import { SettingsModal } from "./SettingsModal";
import { HeaderNewChatButton } from "./NewChatButton";
import { useSettings } from "@/hooks/useSettings";
import { useSessionManager } from "@/lib/session-management";

interface TopBarProps {
  onClearChats?: () => void;
  onSessionSelect?: (sessionId: string) => void;
  onNewSession?: () => void;
  notebookId?: string;
}

export const TopBar = ({ onClearChats, onSessionSelect, onNewSession, notebookId }: TopBarProps) => {
  const [pendingJobs] = useState(2); // Mock pending jobs count
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { settings, updateSettings } = useSettings();
  const { createNewSession } = useSessionManager();
  const llmProvider = settings.llmProvider;

  const handleClearChats = () => {
    onClearChats?.();
    toast("Chat history cleared");
  };

  const handleProfileClick = () => {
    toast("Profile settings coming soon");
  };

  const handleProviderToggle = (checked: boolean) => {
    const newProvider = checked ? 'OLLAMA' : 'OPENAI';
    updateSettings({ llmProvider: newProvider });
    toast(`Switched to ${newProvider}`);
  };

  const handleSessionSelect = (sessionId: string) => {
    onSessionSelect?.(sessionId);
  };

  const handleNewSession = async () => {
    try {
      const newSessionId = await createNewSession(notebookId);
      onNewSession?.();
      toast("New chat session created");
    } catch (error) {
      console.error('Failed to create new session:', error);
      toast("Failed to create new session", { description: "Please try again" });
    }
  };
  return (
    <div className="h-14 bg-background border-b flex items-center justify-between px-4 sticky top-0 z-40">
      {/* Left - History Drawer */}
      <div className="flex items-center gap-3">
        <HistoryDrawer onSessionSelect={handleSessionSelect} />
        <HeaderNewChatButton
          notebookId={notebookId}
          onNewSession={handleNewSession}
          currentSessionId={undefined} // TopBar doesn't track current session
          showConfirmation={false} // Skip confirmation in header for quick access
          label="New Chat"
        />
      </div>

      {/* Center - Title */}
      <div className="flex items-center gap-2">
        <span className="text-xl">🏙️</span>
        <h1 className="text-lg font-semibold text-foreground hidden sm:block">
          Town Planner Assistant
        </h1>
        <h1 className="text-lg font-semibold text-foreground sm:hidden">
          Town Planner
        </h1>
      </div>

      {/* Right - LLM Toggle, Bell & Avatar */}
      <div className="flex items-center gap-3">
        {/* LLM Provider Toggle */}
        <div className="flex items-center gap-2">
          <Label htmlFor="llm-provider" className="text-sm font-medium">
            {llmProvider}
          </Label>
          <Switch
            id="llm-provider"
            checked={llmProvider === 'OLLAMA'}
            onCheckedChange={handleProviderToggle}
          />
        </div>

        {/* Bell Icon with Badge */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {pendingJobs > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {pendingJobs}
            </Badge>
          )}
        </Button>

        {/* Settings Gear Button */}
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
          <Settings className="h-4 w-4" />
        </Button>

        {/* Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/lovable-uploads/425ef66d-dec6-4935-8b6a-913c0d095c21.png" alt="User" />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-background border shadow-lg z-50">
            <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSettings(true)} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearChats} className="cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Chats
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Settings Modal */}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};