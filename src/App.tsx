import React, { useState, useEffect } from 'react';
import { UserProfile, ObjectAnalysisResult, FeedbackItem } from './types';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { EcoScanner } from './components/EcoScanner';
import { ChatAssistant } from './components/ChatAssistant';
import { WasteToBest } from './components/WasteToBest';
import { CommunityFeedback } from './components/CommunityFeedback';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import {
  initAuth,
  getAccessToken,
  setCachedAccessToken,
  logoutGoogle,
} from './services/firebaseAuth';
import {
  DEFAULT_SHEET_ID_KEY,
  DEFAULT_SHEET_URL_KEY,
  appendLoginRecord,
  appendFeedbackRecord,
  appendMultipleFeedbackRecords,
  appendMultipleLoginRecords,
} from './services/googleSheets';
import { Leaf, ShieldCheck, Heart, Sparkles, ExternalLink, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('eco_tech_user_profile_v1');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<'scanner' | 'chat' | 'waste-to-best' | 'community'>('scanner');
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [adminSyncStatus, setAdminSyncStatus] = useState<string | null>(null);

  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem(DEFAULT_SHEET_ID_KEY) || null;
  });

  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    return localStorage.getItem(DEFAULT_SHEET_URL_KEY) || null;
  });

  // Cross-module context passing
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>(undefined);
  const [chatContextItem, setChatContextItem] = useState<ObjectAnalysisResult | null>(null);

  // Initialize Firebase Auth. Sheet settings remain local to each user's browser.
  useEffect(() => {
    // Initialize Auth
    initAuth(
      (user, token) => {
        setGoogleAccessToken(token);
        setCachedAccessToken(token);
        // If admin with active spreadsheet, trigger background auto-sync
        if (token && user?.email?.toLowerCase() === 'arjitagrim1605@gmail.com') {
          syncAllPendingDataToSheet(token, spreadsheetId || localStorage.getItem(DEFAULT_SHEET_ID_KEY) || '');
        }
      },
      () => {
        setGoogleAccessToken(null);
        setCachedAccessToken(null);
      }
    );

    // If no user profile exists, open the Login starting interface
    if (!userProfile) {
      setIsLoginOpen(true);
    }
  }, []);

  const syncAllPendingDataToSheet = async (token?: string, targetSheetId?: string) => {
    const activeToken = token || googleAccessToken || (await getAccessToken());
    const sheetId = targetSheetId || spreadsheetId || localStorage.getItem(DEFAULT_SHEET_ID_KEY);

    if (!activeToken || !sheetId) {
      return { success: false, error: 'Sign in to Google to sync spreadsheet' };
    }

    setIsSyncingAll(true);
    setAdminSyncStatus('Syncing all community feedbacks (including Pooja’s) to Google Sheets...');

    try {
      // 1. Fetch all feedbacks from server database
      const fRes = await fetch('/api/feedbacks');
      const fData = await fRes.json();
      let feedbackCount = 0;

      if (fData.success && Array.isArray(fData.feedbacks) && fData.feedbacks.length > 0) {
        const recordsToAppend = fData.feedbacks.map((f: any) => ({
          name: f.name,
          email: f.email,
          rating: f.rating,
          category: f.category,
          comment: f.comment,
          timestamp: f.timestamp,
        }));
        feedbackCount = await appendMultipleFeedbackRecords(activeToken, sheetId, recordsToAppend);

        // Mark synced
        const ids = fData.feedbacks.map((f: any) => f.id);
        await fetch('/api/feedbacks/mark-synced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      }

      // 2. Fetch logins from server
      const lRes = await fetch('/api/logins');
      const lData = await lRes.json();
      if (lData.success && Array.isArray(lData.logins) && lData.logins.length > 0) {
        await appendMultipleLoginRecords(activeToken, sheetId, lData.logins);
      }

      setAdminSyncStatus(`Synced ${feedbackCount} community reviews to Google Sheets tab 'Community Feedback'!`);
      setTimeout(() => setAdminSyncStatus(null), 5000);
      return { success: true };
    } catch (err: any) {
      console.error('Error syncing all to sheet:', err);
      setAdminSyncStatus(`Sync error: ${err?.message || 'Check Google permissions'}`);
      return { success: false, error: err?.message };
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleLoginSuccess = async (profile: UserProfile, token?: string) => {
    setUserProfile(profile);
    try {
      localStorage.setItem('eco_tech_user_profile_v1', JSON.stringify(profile));
    } catch (e) {}
    setIsLoginOpen(false);

    const activeToken = token || googleAccessToken;
    if (activeToken) {
      setGoogleAccessToken(activeToken);
      setCachedAccessToken(activeToken);

      // If a spreadsheet is already linked, append login record
      if (spreadsheetId) {
        try {
          await appendLoginRecord(activeToken, spreadsheetId, {
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            college: profile.college,
          });
        } catch (err) {
          console.warn('Could not auto-append login to sheet:', err);
        }
      }
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUserProfile(null);
    setGoogleAccessToken(null);
    try {
      localStorage.removeItem('eco_tech_user_profile_v1');
    } catch (e) {}
    setIsLoginOpen(true);
  };

  const handleUpdateSpreadsheet = (id: string, url: string) => {
    setSpreadsheetId(id);
    setSpreadsheetUrl(url);
    localStorage.setItem(DEFAULT_SHEET_ID_KEY, id);
    localStorage.setItem(DEFAULT_SHEET_URL_KEY, url);

    // Immediately sync all pending reviews and logins
    if (googleAccessToken) {
      syncAllPendingDataToSheet(googleAccessToken, id);
    }
  };

  const handleRecordFeedbackToSheet = async (
    feedback: FeedbackItem
  ): Promise<{ success: boolean; error?: string }> => {
    let token = googleAccessToken;
    if (!token) {
      token = await getAccessToken();
    }
    const currentSheetId = spreadsheetId || localStorage.getItem(DEFAULT_SHEET_ID_KEY);

    if (!currentSheetId) {
      return { success: false, error: 'No Google Sheet linked' };
    }
    if (!token) {
      return { success: false, error: 'Google Account not signed in' };
    }

    try {
      await appendFeedbackRecord(token, currentSheetId, {
        name: feedback.name,
        email: feedback.email,
        rating: feedback.rating,
        category: feedback.category,
        comment: feedback.comment,
      });
      return { success: true };
    } catch (err: any) {
      console.error('appendFeedbackRecord error:', err);
      return { success: false, error: err?.message || 'Could not append to Google Sheet' };
    }
  };

  const handleScannerFollowUpInChat = (prompt: string, contextItem: ObjectAnalysisResult) => {
    setChatInitialPrompt(prompt);
    setChatContextItem(contextItem);
    setActiveTab('chat');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'chat') {
            setChatInitialPrompt(undefined);
          }
          setActiveTab(tab);
        }}
        userProfile={userProfile}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        onOpenSheetModal={() => setIsSheetModalOpen(true)}
        isSheetSynced={!!spreadsheetId}
        spreadsheetId={spreadsheetId}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Private Admin Hub (ONLY visible to arjitagrim1605@gmail.com) */}
        {userProfile?.email?.toLowerCase() === 'arjitagrim1605@gmail.com' && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-emerald-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  spreadsheetId
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                }`}
              >
                {spreadsheetId ? '📊' : '⚡'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    {spreadsheetId
                      ? 'Admin Data Sync: Eco Tech AI - Master Data Hub'
                      : 'Admin Google Sheets: Ready to Setup'}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                    Admin Private
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {spreadsheetId
                    ? 'User registrations and community reviews are quietly appending to your Google Sheet tabs.'
                    : 'Click below to create the master Google Spreadsheet in your account.'}
                </p>
                {adminSyncStatus && (
                  <p className="text-[11px] text-emerald-300 font-semibold mt-1 flex items-center gap-1.5 animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{adminSyncStatus}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
              {spreadsheetId ? (
                <>
                  <button
                    onClick={() => syncAllPendingDataToSheet()}
                    disabled={isSyncingAll}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    title="Push all community feedback (including Pooja's review) to Google Sheets"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                    <span>{isSyncingAll ? 'Syncing...' : 'Sync Reviews to Sheet'}</span>
                  </button>

                  <a
                    href={
                      spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => setIsSheetModalOpen(true)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
                  >
                    Manage Sheet
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsSheetModalOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Create Master Sheet Now</span>
                  </button>

                  <a
                    href="https://sheets.new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <span>sheets.new</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        {/* Regular User Welcome Badge (Clean & Discreet) */}
        {userProfile && userProfile?.email?.toLowerCase() !== 'arjitagrim1605@gmail.com' && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">🌱</span>
              <span>
                Welcome, <strong className="text-white">{userProfile.name}</strong> •{' '}
                <span className="text-slate-400">{userProfile.college}</span>
              </span>
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">Eco Community Active</span>
          </div>
        )}

        {/* Tab 1: AI Eco Channel (Object Analysis) */}
        {activeTab === 'scanner' && (
          <div className="animate-fade-in">
            <EcoScanner onAskChatFollowUp={handleScannerFollowUpInChat} />
          </div>
        )}

        {/* Tab 2: Chat Assistant */}
        {activeTab === 'chat' && (
          <div className="animate-fade-in">
            <ChatAssistant
              initialPrompt={chatInitialPrompt}
              contextItem={chatContextItem}
              onClearContext={() => setChatContextItem(null)}
            />
          </div>
        )}

        {/* Tab 3: Waste to Best */}
        {activeTab === 'waste-to-best' && (
          <div className="animate-fade-in">
            <WasteToBest />
          </div>
        )}

        {/* Tab 4: Community Feedback */}
        {activeTab === 'community' && (
          <div className="animate-fade-in">
            <CommunityFeedback
              userProfile={userProfile}
              onRecordFeedbackToSheet={handleRecordFeedbackToSheet}
              isSheetSynced={!!spreadsheetId}
              spreadsheetUrl={spreadsheetUrl}
              onOpenSheetModal={() => setIsSheetModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-8 text-xs text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-emerald-500/30 flex items-center justify-center p-0.5 shadow shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/logo_fitted.png"
                alt="Eco Tech AI Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-slate-200">Eco Tech AI</span>
            <span>• Environmental Intelligence & Circular Economy Platform</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            {userProfile?.email?.toLowerCase() === 'arjitagrim1605@gmail.com' && (
              <button
                onClick={() => setIsSheetModalOpen(true)}
                className="text-[11px] text-emerald-400/80 hover:text-emerald-300 transition cursor-pointer"
              >
                Admin Sync Hub
              </button>
            )}
            <span>© 2026 Eco Tech AI • Circular Intelligence</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              Built with <Heart className="w-3 h-3 text-emerald-500 fill-emerald-500" /> for Planet Earth
            </span>
          </div>
        </div>
      </footer>

      {/* Login Starting Interface Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onLoginSuccess={handleLoginSuccess}
        defaultEmail=""
      />

      {/* Google Sheets Sync Modal */}
      <GoogleSheetsModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        spreadsheetId={spreadsheetId}
        spreadsheetUrl={spreadsheetUrl}
        onUpdateSpreadsheet={handleUpdateSpreadsheet}
        googleAccessToken={googleAccessToken}
        onTokenAcquired={(token) => {
          setGoogleAccessToken(token);
          setCachedAccessToken(token);
        }}
        adminEmail="arjitagrim1605@gmail.com"
      />
    </div>
  );
}
