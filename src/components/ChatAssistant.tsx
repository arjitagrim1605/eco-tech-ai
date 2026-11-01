import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatSession, ObjectAnalysisResult } from '../types';
import { voiceAssistant } from '../utils/voiceAssistant';
import {
  Send,
  Mic,
  Volume2,
  VolumeX,
  History,
  Trash2,
  PlusCircle,
  Sparkles,
  Bot,
  User,
  HelpCircle,
  Copy,
  Check,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface ChatAssistantProps {
  initialPrompt?: string;
  contextItem?: ObjectAnalysisResult | null;
  onClearContext?: () => void;
}

const STORAGE_CHAT_KEY = 'eco_tech_chat_sessions_v1';

const QUICK_PROMPTS = [
  'How do I start composting food waste in an apartment?',
  'Which plastic recycling numbers are easiest to recycle?',
  'Creative ideas to eliminate single-use plastics in daily life',
  'What should I do with damaged electronic cables and lithium batteries?',
  'How do zero-waste grocery stores operate?',
];

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  initialPrompt,
  contextItem,
  onClearContext,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CHAT_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'default-session',
        title: 'Welcome Eco Chat',
        createdAt: new Date().toLocaleDateString(),
        messages: [
          {
            id: 'msg-welcome',
            role: 'assistant',
            content:
              "Hello! I am your Eco Tech AI Assistant 🌱. I'm here to answer any questions about sustainability, zero-waste habits, recycling techniques, material breakdown times, or how to dispose of tricky items. How can I assist your eco journey today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ],
      },
    ];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>('default-session');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(sessions));
    } catch (e) {}
  }, [sessions]);

  // Handle external prompt passed from scanner
  useEffect(() => {
    if (initialPrompt) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const currentSession =
    sessions.find((s) => s.id === currentSessionId) || sessions[0] || {
      id: 'default',
      title: 'Current Chat',
      createdAt: new Date().toLocaleDateString(),
      messages: [],
    };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession.messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    setInputMessage('');
    voiceAssistant.stop();
    setSpeakingMessageId(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update active session with user message
    const updatedMessages = [...currentSession.messages, userMsg];
    updateCurrentSessionMessages(updatedMessages);

    setIsLoading(true);

    try {
      // Prepare history for API
      const historyPayload = updatedMessages.slice(-8).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        content: m.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          currentContext: contextItem
            ? {
                objectName: contextItem.objectName,
                category: contextItem.category,
                biodegradable: contextItem.isBiodegradable,
                disposalBin: contextItem.disposalGuide.recommendedBin,
              }
            : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get answer from Eco Assistant.');
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      updateCurrentSessionMessages([...updatedMessages, botMsg]);

      // If user used voice recognition to send, automatically speak reply
      if (isListening || textToSend === initialPrompt) {
        speakBotMessage(botMsg.id, botMsg.content);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Sorry, I could not complete that response: ${err.message}. Please try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      updateCurrentSessionMessages([...updatedMessages, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCurrentSessionMessages = (newMessages: ChatMessage[]) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === currentSessionId) {
          // Update title if first custom message
          let title = s.title;
          if (s.messages.length <= 1 && newMessages.length > 1) {
            const firstUserMsg = newMessages.find((m) => m.role === 'user');
            if (firstUserMsg) {
              title = firstUserMsg.content.slice(0, 28) + (firstUserMsg.content.length > 28 ? '...' : '');
            }
          }
          return { ...s, messages: newMessages, title };
        }
        return s;
      })
    );
  };

  const startNewChat = () => {
    voiceAssistant.stop();
    setSpeakingMessageId(null);
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'New Eco Session',
      createdAt: new Date().toLocaleDateString(),
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: 'Started a fresh session! What eco topic would you like to explore?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setShowHistorySidebar(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      startNewChat();
      return;
    }
    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);
    if (currentSessionId === id) {
      setCurrentSessionId(filtered[0].id);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      voiceAssistant.stopListening();
      setIsListening(false);
    } else {
      setIsListening(true);
      voiceAssistant.startListening(
        (transcript) => {
          setIsListening(false);
          setInputMessage(transcript);
          handleSendMessage(transcript);
        },
        () => setIsListening(true),
        () => setIsListening(false),
        (err) => {
          console.warn('Voice rec error:', err);
          setIsListening(false);
        }
      );
    }
  };

  const speakBotMessage = (id: string, text: string) => {
    if (speakingMessageId === id) {
      voiceAssistant.stop();
      setSpeakingMessageId(null);
    } else {
      setSpeakingMessageId(id);
      voiceAssistant.speak(
        text,
        () => setSpeakingMessageId(id),
        () => setSpeakingMessageId(null),
        () => setSpeakingMessageId(null)
      );
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-center p-1.5 shadow-lg shadow-emerald-900/40 shrink-0 overflow-hidden">
            <img
              src="/assets/aistudio/logo_fitted.png"
              alt="Eco Tech AI Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Eco Assistant
              </span>
              <span className="text-xs text-slate-400">Column 2 of 4</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              AI Sustainability Chat & Voice Assistant
            </h2>
            <p className="text-xs text-slate-300">
              Ask any question about waste management, material lifespans, zero-waste tips, and recycling codes.
            </p>
          </div>
        </div>

        {/* History Toggle & New Chat */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
              showHistorySidebar
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Chat History ({sessions.length})</span>
          </button>

          <button
            onClick={startNewChat}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Scanned Context Banner */}
      {contextItem && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-200">
            <span className="text-base">📌</span>
            <span>
              Active Context: <strong className="text-white">{contextItem.objectName}</strong> (
              {contextItem.category}) - Assigned Bin: {contextItem.disposalGuide.recommendedBin}
            </span>
          </div>
          {onClearContext && (
            <button
              onClick={onClearContext}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Clear context
            </button>
          )}
        </div>
      )}

      {/* Main Chat Layout (Chat view + Collapsible History Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[580px]">
        {/* History Sidebar */}
        {showHistorySidebar && (
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between shadow-xl animate-fade-in">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Past Sessions
                </span>
                <span className="text-[10px] text-slate-500">{sessions.length} chats</span>
              </div>
              <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      setCurrentSessionId(session.id);
                      setShowHistorySidebar(false);
                    }}
                    className={`p-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-between transition group ${
                      session.id === currentSessionId
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-800/40 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <p className="font-medium truncate">{session.title}</p>
                      <span className="text-[10px] text-slate-500">{session.createdAt}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={startNewChat}
              className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Start Fresh Topic</span>
            </button>
          </div>
        )}

        {/* Chat Messages Container */}
        <div
          className={`${
            showHistorySidebar ? 'lg:col-span-3' : 'lg:col-span-4'
          } bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-2xl overflow-hidden`}
        >
          {/* Scrollable messages area */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[520px] min-h-[420px]">
            {currentSession.messages.map((message) => {
              const isAssistant = message.role === 'assistant';
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-md text-sm ${
                      isAssistant
                        ? 'bg-slate-800/80 border border-slate-700/80 text-slate-200'
                        : 'bg-emerald-600 text-white rounded-tr-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>

                    {/* Footer bar with timestamp, voice audio button, and copy */}
                    <div
                      className={`flex items-center justify-between gap-3 mt-2 pt-1 text-[11px] border-t ${
                        isAssistant
                          ? 'border-slate-700/60 text-slate-400'
                          : 'border-emerald-500/40 text-emerald-100'
                      }`}
                    >
                      <span>{message.timestamp}</span>

                      {isAssistant && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => speakBotMessage(message.id, message.content)}
                            className="hover:text-emerald-300 transition flex items-center gap-1 cursor-pointer"
                            title="Listen to this message"
                          >
                            {speakingMessageId === message.id ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                                <span className="text-rose-300 text-[10px]">Speaking...</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span className="text-[10px]">Listen</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => copyToClipboard(message.id, message.content)}
                            className="hover:text-white transition flex items-center gap-1 cursor-pointer"
                            title="Copy text"
                          >
                            {copiedId === message.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isAssistant && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Eco AI is thinking and formulating guidance...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-slate-400 shrink-0 font-medium">Suggestions:</span>
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 shrink-0 transition cursor-pointer disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box with Voice Mic */}
          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* Voice Input Mic Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-3 rounded-xl transition cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700'
                }`}
                title={isListening ? 'Listening... click to stop' : 'Speak with Voice Assistant'}
              >
                <Mic className="w-5 h-5" />
              </button>

              <input
                type="text"
                placeholder={
                  isListening
                    ? 'Listening to your voice...'
                    : 'Ask about recycling, composting, zero waste, plastics...'
                }
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl shadow-lg shadow-emerald-900/30 transition cursor-pointer shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
