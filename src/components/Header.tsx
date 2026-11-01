import React from 'react';
import { UserProfile } from '../types';
import {
  Leaf,
  Scan,
  MessageSquare,
  Sparkles,
  Users,
  FileSpreadsheet,
  LogOut,
  User,
  GraduationCap,
  Share2,
  Check,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'scanner' | 'chat' | 'waste-to-best' | 'community';
  onTabChange: (tab: 'scanner' | 'chat' | 'waste-to-best' | 'community') => void;
  userProfile: UserProfile | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenSheetModal: () => void;
  isSheetSynced: boolean;
  spreadsheetId: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  userProfile,
  onOpenLogin,
  onLogout,
  onOpenSheetModal,
  isSheetSynced,
  spreadsheetId,
}) => {
  const [copiedLink, setCopiedLink] = React.useState(false);

  const handleShare = () => {
    const publicUrl =
      typeof window !== 'undefined' && window.location.origin.includes('ais-')
        ? window.location.origin.replace('ais-dev-', 'ais-pre-')
        : 'https://ais-pre-cwntk46f4tppivodjjw7pq-726667845026.asia-northeast1.run.app';

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };
  const tabs = [
    {
      id: 'scanner' as const,
      label: 'AI Eco Channel',
      sublabel: 'Object Analysis',
      icon: Scan,
    },
    {
      id: 'chat' as const,
      label: 'Chat Assistant',
      sublabel: 'Voice & Eco Advice',
      icon: MessageSquare,
    },
    {
      id: 'waste-to-best' as const,
      label: 'Waste to Best',
      sublabel: 'Trash to Treasure',
      icon: Sparkles,
    },
    {
      id: 'community' as const,
      label: 'Community Feedback',
      sublabel: '5-Star Reviews',
      icon: Users,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-center p-1 shadow-md shadow-emerald-500/20 shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/logo_fitted.png"
                alt="Eco Tech AI Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white tracking-tight">Eco Tech AI</h1>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Circular Tech
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Biodegradability • Upcycling • Voice Assistant
              </p>
            </div>
          </div>

          {/* Desktop Tab Navigation */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-400'}`} />
                  <div className="text-left">
                    <div>{tab.label}</div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* User Profile & Controls */}
          <div className="flex items-center gap-2">
            {/* Share Public Link Button */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
              title="Copy public link to share Eco Tech AI"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-bold">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline text-[11px]">Share App</span>
                </>
              )}
            </button>

            {/* Google Sheets Admin Pill (Only visible to arjitagrim1605@gmail.com) */}
            {userProfile?.email?.toLowerCase() === 'arjitagrim1605@gmail.com' && (
              <button
                onClick={onOpenSheetModal}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  spreadsheetId
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-emerald-500/40'
                }`}
                title="Admin: Google Sheets Master Hub"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline">
                  {spreadsheetId ? 'Admin Sheets' : 'Setup Sheets'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    spreadsheetId ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
              </button>
            )}

            {/* User Profile Badge */}
            {userProfile ? (
              <div className="flex items-center gap-2 pl-1">
                <div
                  onClick={onOpenLogin}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                  title="View / Edit Profile Details"
                >
                  {userProfile.googlePhotoUrl ? (
                    <img
                      src={userProfile.googlePhotoUrl}
                      alt={userProfile.name}
                      className="w-7 h-7 rounded-lg object-cover border border-emerald-500/40"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-emerald-600/30 text-emerald-300 font-bold flex items-center justify-center text-xs border border-emerald-500/30">
                      {userProfile.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left hidden sm:block max-w-[120px]">
                    <div className="text-xs font-bold text-white truncate">{userProfile.name}</div>
                    <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      <GraduationCap className="w-2.5 h-2.5 text-emerald-400" />
                      {userProfile.college}
                    </div>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition cursor-pointer"
                  title="Switch User / Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="lg:hidden py-2.5 border-t border-slate-800 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white bg-slate-900/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
