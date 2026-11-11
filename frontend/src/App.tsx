import React, { useState, useEffect, useCallback } from 'react';
import { Conversation, Message, Memory, AppMode, HealthStatus, MemoryType } from './types';
import { api } from './services/api';
import { demoService } from './services/demoService';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ChatArea } from './components/chat/ChatArea';
import { MemoryPanel } from './components/memory/MemoryPanel';

export const App: React.FC = () => {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('recall_theme');
    if (saved !== null) {
      return saved === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // App mode state: live vs demo
  const [appMode, setAppMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('recall_app_mode') as AppMode;
    return saved === 'demo' ? 'demo' : 'live';
  });

  // UI state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    return localStorage.getItem('recall_active_conv_id');
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isMemoryPanelOpen, setIsMemoryPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus>({ status: 'offline' });

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('recall_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('recall_theme', 'light');
    }
  }, [darkMode]);

  // Sync active conversation ID
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem('recall_active_conv_id', activeConversationId);
    } else {
      localStorage.removeItem('recall_active_conv_id');
    }
  }, [activeConversationId]);

  // Sync app mode to storage
  useEffect(() => {
    localStorage.setItem('recall_app_mode', appMode);
  }, [appMode]);

  // Periodic health check for live mode
  const checkHealth = useCallback(async () => {
    if (appMode === 'live') {
      const status = await api.checkHealth();
      setHealth(status);
    }
  }, [appMode]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Load conversations based on mode
  const loadConversations = useCallback(async () => {
    try {
      if (appMode === 'demo') {
        const list = demoService.listConversations();
        setConversations(list);
        const savedId = localStorage.getItem('recall_active_conv_id');
        if (savedId && list.some((c) => c.id === savedId)) {
          setActiveConversationId(savedId);
        } else if (list.length > 0 && !activeConversationId) {
          setActiveConversationId(list[0].id);
        }
      } else {
        const list = await api.listConversations();
        setConversations(list);
        const savedId = localStorage.getItem('recall_active_conv_id');
        if (savedId && list.some((c) => c.id === savedId)) {
          setActiveConversationId(savedId);
        } else if (list.length > 0 && !activeConversationId) {
          setActiveConversationId(list[0].id);
        }
      }
    } catch (err: any) {
      console.warn('Backend unavailable on load:', err);
      if (appMode === 'live') {
        setConversations([]);
      }
    } finally {
      setIsInitialLoading(false);
    }
  }, [appMode, activeConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages and memories for active conversation
  const loadActiveConversationData = useCallback(async (convId: string) => {
    try {
      setIsMemoriesLoading(true);
      if (appMode === 'demo') {
        const msgs = demoService.getMessages(convId);
        const mems = demoService.getMemories(convId);
        setMessages(msgs);
        setMemories(mems);
      } else {
        const [msgs, mems] = await Promise.all([
          api.getMessages(convId),
          api.getMemories(convId),
        ]);
        setMessages(msgs);
        setMemories(mems);
      }
    } catch (err: any) {
      console.error('Failed to load active conversation messages/memories', err);
    } finally {
      setIsMemoriesLoading(false);
    }
  }, [appMode]);

  useEffect(() => {
    if (activeConversationId) {
      loadActiveConversationData(activeConversationId);
    } else {
      setMessages([]);
      setMemories([]);
    }
  }, [activeConversationId, loadActiveConversationData]);

  // Handle switching mode
  const handleToggleMode = (newMode: AppMode) => {
    if (newMode === appMode) return;
    setAppMode(newMode);
    setActiveConversationId(null);
  };

  // Reset demo data
  const handleResetDemoData = () => {
    demoService.reset();
    const list = demoService.listConversations();
    setConversations(list);
    if (list.length > 0) {
      setActiveConversationId(list[0].id);
      loadActiveConversationData(list[0].id);
    }
  };

  // Create new conversation
  const handleNewConversation = async () => {
    try {
      let newConv: Conversation;
      if (appMode === 'demo') {
        newConv = demoService.createConversation('New Chat');
      } else {
        newConv = await api.createConversation('New Chat');
      }
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setMemories([]);
      setIsMobileMenuOpen(false);
    } catch (err: any) {
      console.error(`Failed to create conversation:`, err);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      if (appMode === 'demo') {
        demoService.deleteConversation(id);
      } else {
        await api.deleteConversation(id);
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      console.error(`Failed to delete conversation:`, err);
    }
  };

  // Rename conversation
  const handleRenameConversation = async (newTitle: string) => {
    if (!activeConversationId) return;
    try {
      let updated: Conversation;
      if (appMode === 'demo') {
        updated = demoService.updateConversation(activeConversationId, newTitle);
      } else {
        updated = await api.updateConversation(activeConversationId, newTitle);
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
    } catch (err: any) {
      console.error(`Failed to rename conversation:`, err);
    }
  };

  // Send message
  const handleSendMessage = async (text: string) => {
    let targetConvId = activeConversationId;

    // Automatically create a new conversation if none is selected
    if (!targetConvId) {
      try {
        const title = text.slice(0, 32) + (text.length > 32 ? '...' : '');
        let newConv: Conversation;
        if (appMode === 'demo') {
          newConv = demoService.createConversation(title);
        } else {
          newConv = await api.createConversation(title);
        }
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        targetConvId = newConv.id;
      } catch (err: any) {
        console.error(`Failed to initialize conversation:`, err);
        return;
      }
    }

    // Optimistically append user message to UI
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: targetConvId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      if (appMode === 'demo') {
        const result = await demoService.chat(targetConvId, text);
        const asstMsg: Message = {
          id: `demo-asst-${Date.now()}`,
          conversation_id: targetConvId,
          role: 'assistant',
          content: result.reply,
          created_at: new Date().toISOString(),
          sources: result.sources,
          isSimulated: true,
        };
        setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, asstMsg]);
        const updatedMemories = demoService.getMemories(targetConvId);
        setMemories(updatedMemories);
      } else {
        const result = await api.chat(targetConvId, text);
        const asstMsg: Message = {
          id: `asst-${Date.now()}`,
          conversation_id: targetConvId,
          role: 'assistant',
          content: result.reply,
          created_at: new Date().toISOString(),
          sources: result.sources,
          isSimulated: false,
        };
        // Replace temp message with server message if needed and add assistant response
        setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, asstMsg]);

        // Refetch memories to display newly extracted decisions/facts
        const updatedMems = await api.getMemories(targetConvId);
        setMemories(updatedMems);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        conversation_id: targetConvId,
        role: 'assistant',
        content: `⚠️ ${err.message || 'Unable to connect to backend.'}\n\n*Tip: You can switch to **Demo Mode** in the sidebar to test without API keys or a running server.*`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add manual memory
  const handleAddMemory = async (data: { type: MemoryType; subject: string; content: string }) => {
    if (!activeConversationId) return;

    if (appMode === 'demo') {
      const newMem = demoService.saveMemory(activeConversationId, data);
      setMemories((prev) => [newMem, ...prev]);
    } else {
      const newMem = await api.saveMemory(activeConversationId, data);
      setMemories((prev) => [newMem, ...prev]);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-black text-slate-900 dark:text-white font-sans">
      {/* Left Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          setIsMobileMenuOpen(false);
        }}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        appMode={appMode}
        onToggleMode={handleToggleMode}
        health={health}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onResetDemoData={handleResetDemoData}
        isOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Chat Work Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        <Header
          conversation={activeConversation}
          onRenameConversation={handleRenameConversation}
          onToggleMemoryPanel={() => setIsMemoryPanelOpen(!isMemoryPanelOpen)}
          isMemoryPanelOpen={isMemoryPanelOpen}
          memoryCount={memories.length}
          appMode={appMode}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <ChatArea
          messages={messages}
          isLoading={isLoading}
          isInitialLoading={isInitialLoading}
          hasActiveConversation={Boolean(activeConversationId)}
          appMode={appMode}
          onSendMessage={handleSendMessage}
        />
      </div>

      {/* Collapsible Memory Drawer */}
      <MemoryPanel
        isOpen={isMemoryPanelOpen}
        onClose={() => setIsMemoryPanelOpen(false)}
        memories={memories}
        onAddMemory={handleAddMemory}
        isLoading={isMemoriesLoading}
      />
    </div>
  );
};

