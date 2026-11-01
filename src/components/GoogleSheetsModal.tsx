import React, { useState } from 'react';
import {
  createEcoTechSpreadsheet,
  DEFAULT_SHEET_ID_KEY,
  DEFAULT_SHEET_URL_KEY,
  appendMultipleFeedbackRecords,
  appendMultipleLoginRecords,
} from '../services/googleSheets';
import { googleSignIn, getAccessToken, logoutGoogle } from '../services/firebaseAuth';
import {
  FileSpreadsheet,
  ExternalLink,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  KeyRound,
  Download,
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  onUpdateSpreadsheet: (id: string, url: string) => void;
  googleAccessToken: string | null;
  onTokenAcquired: (token: string) => void;
  adminEmail?: string;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  spreadsheetId,
  spreadsheetUrl,
  onUpdateSpreadsheet,
  googleAccessToken,
  onTokenAcquired,
  adminEmail = 'arjitagrim1605@gmail.com',
}) => {
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    isScopeError?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  if (!isOpen) return null;

  const handleConnectGoogle = async (forceConsent = true) => {
    setIsConnectingGoogle(true);
    setStatusMessage(null);
    try {
      const result = await googleSignIn(forceConsent);
      if (result) {
        onTokenAcquired(result.accessToken);
        setStatusMessage({
          type: 'success',
          text: `Google account connected (${result.user.email || adminEmail}) with Google Sheets access granted!`,
        });
        return result.accessToken;
      }
    } catch (err: any) {
      console.error('Google connect error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Could not connect Google account.',
      });
    } finally {
      setIsConnectingGoogle(false);
    }
    return null;
  };

  const handleCreateAutoSheet = async () => {
    let token = googleAccessToken;
    if (!token) {
      token = await getAccessToken();
    }

    // If no token exists, prompt sign in first
    if (!token) {
      token = await handleConnectGoogle(true);
      if (!token) return;
    }

    setIsCreatingSheet(true);
    setStatusMessage({
      type: 'info',
      text: 'Creating Master Google Spreadsheet in your Google Drive...',
    });

    try {
      const res = await createEcoTechSpreadsheet(token);
      onUpdateSpreadsheet(res.id, res.url);
      setStatusMessage({
        type: 'success',
        text: 'Master Google Spreadsheet successfully created with "User Logins" and "Community Feedback" tabs!',
      });
    } catch (err: any) {
      console.error('Failed to create sheet:', err);
      const isScopeIssue =
        err?.message?.includes('insufficient authentication scopes') ||
        err?.message?.includes('403') ||
        err?.message?.includes('scope');

      if (isScopeIssue) {
        setStatusMessage({
          type: 'error',
          text: 'Google Sheets permissions were not granted by your browser session. Please click the button below to authorize Google Sheets.',
          isScopeError: true,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: err?.message || 'Failed to create spreadsheet. Ensure Google Sheets permissions are granted.',
        });
      }
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleReauthorizeAndCreate = async () => {
    // Force prompt for consent
    const freshToken = await handleConnectGoogle(true);
    if (freshToken) {
      setIsCreatingSheet(true);
      try {
        const res = await createEcoTechSpreadsheet(freshToken);
        onUpdateSpreadsheet(res.id, res.url);
        setStatusMessage({
          type: 'success',
          text: 'Google Sheets permission granted and Master Spreadsheet created successfully!',
        });
      } catch (retryErr: any) {
        setStatusMessage({
          type: 'error',
          text: retryErr?.message || 'Failed to create sheet after authorization.',
        });
      } finally {
        setIsCreatingSheet(false);
      }
    }
  };

  const handleLinkExistingSheet = () => {
    const raw = customSheetInput.trim();
    if (!raw) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Google Sheet ID or URL.' });
      return;
    }

    // Extract ID if a full URL was provided
    // https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
    const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const extractedId = match ? match[1] : raw;

    const url = `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;
    onUpdateSpreadsheet(extractedId, url);
    setStatusMessage({
      type: 'success',
      text: `Successfully linked Spreadsheet ID: ${extractedId}`,
    });
    setCustomSheetInput('');
  };

  const handleSyncAllNow = async () => {
    let token = googleAccessToken;
    if (!token) token = await getAccessToken();
    if (!token) {
      token = await handleConnectGoogle(true);
      if (!token) return;
    }
    const currentId = spreadsheetId || customSheetInput;
    if (!currentId) {
      setStatusMessage({ type: 'error', text: 'Please create or link a spreadsheet first.' });
      return;
    }

    setIsManualSyncing(true);
    setStatusMessage({
      type: 'info',
      text: "Syncing all community reviews (including Pooja's review) to Google Sheets...",
    });

    try {
      const fRes = await fetch('/api/feedbacks');
      const fData = await fRes.json();
      let fCount = 0;
      if (fData.success && Array.isArray(fData.feedbacks) && fData.feedbacks.length > 0) {
        fCount = await appendMultipleFeedbackRecords(token, currentId, fData.feedbacks);
        const ids = fData.feedbacks.map((f: any) => f.id);
        await fetch('/api/feedbacks/mark-synced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      }

      const lRes = await fetch('/api/logins');
      const lData = await lRes.json();
      if (lData.success && Array.isArray(lData.logins) && lData.logins.length > 0) {
        await appendMultipleLoginRecords(token, currentId, lData.logins);
      }

      setStatusMessage({
        type: 'success',
        text: `Successfully synced ${fCount} community reviews (including Pooja's review) and all user registrations to Google Sheets tabs!`,
      });
    } catch (err: any) {
      console.error('Manual sync error:', err);
      setStatusMessage({
        type: 'error',
        text: `Sync failed: ${err?.message || 'Check permissions'}`,
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const copyUrl = () => {
    if (spreadsheetUrl) {
      navigator.clipboard.writeText(spreadsheetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Export local backup as CSV
  const handleExportCSV = () => {
    try {
      const loginsRaw = localStorage.getItem('eco_tech_user_profile_v1');
      const feedbacksRaw = localStorage.getItem('eco_tech_community_feedbacks');

      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += '--- USER LOGINS ---\n';
      csvContent += 'Timestamp,Full Name,Email Address,Phone Number,College / Class\n';
      if (loginsRaw) {
        const profile = JSON.parse(loginsRaw);
        csvContent += `"${new Date(profile.loginAt).toLocaleString()}","${profile.name}","${profile.email}","${profile.phone}","${profile.college}"\n`;
      }

      csvContent += '\n--- COMMUNITY FEEDBACK & RATINGS ---\n';
      csvContent += 'Timestamp,User Name,Email,Rating,Category,Feedback / Tip\n';
      if (feedbacksRaw) {
        const list = JSON.parse(feedbacksRaw);
        list.forEach((item: any) => {
          csvContent += `"${item.timestamp}","${item.name}","${item.email}","${item.rating} Stars","${item.category}","${item.comment.replace(/"/g, '""')}"\n`;
        });
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Eco_Tech_AI_Data_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('CSV export failed:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Google Sheets Sync Hub</h3>
              <p className="text-xs text-slate-400">
                Sync user registrations, college records, and community feedback
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {statusMessage && (
            <div
              className={`p-4 rounded-xl text-xs space-y-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                  : statusMessage.type === 'info'
                  ? 'bg-blue-950/80 border border-blue-500/40 text-blue-200'
                  : 'bg-red-950/80 border border-red-500/40 text-red-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : statusMessage.type === 'info' ? (
                  <RefreshCw className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">
                  <p>{statusMessage.text}</p>
                </div>
              </div>

              {/* Scope error prompt button */}
              {statusMessage.isScopeError && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleReauthorizeAndCreate}
                    disabled={isConnectingGoogle || isCreatingSheet}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Authorize Google Sheets Permission & Create Sheet Now</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Connection Status Box */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    googleAccessToken ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-xs font-semibold text-white">
                  {googleAccessToken
                    ? 'Google Account Connected'
                    : 'Google Account Authorization Required'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Target: {adminEmail}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleConnectGoogle(true)}
                disabled={isConnectingGoogle}
                className="flex-1 py-2 px-3 bg-slate-700/80 hover:bg-slate-700 text-white rounded-xl text-xs font-medium border border-slate-600 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isConnectingGoogle
                    ? 'Connecting...'
                    : googleAccessToken
                    ? 'Re-Authorize Google Sheets Scope'
                    : 'Authorize Google Sheets Access'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                title="Download local backup as CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Active Spreadsheet Display or Create New */}
          {spreadsheetId ? (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Active Linked Spreadsheet
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  Ready for Sync
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-slate-300 truncate flex items-center justify-between">
                <span className="truncate">{spreadsheetId}</span>
                <button
                  onClick={copyUrl}
                  className="ml-2 text-slate-400 hover:text-white shrink-0 p-1"
                  title="Copy Link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition text-center flex items-center justify-center gap-1.5"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={handleCreateAutoSheet}
                  disabled={isCreatingSheet}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
                >
                  {isCreatingSheet ? 'Creating...' : 'Create Another'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSyncAllNow}
                disabled={isManualSyncing}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
                <span>{isManualSyncing ? 'Syncing...' : "Sync All Reviews (Including Pooja's) to Sheet Now"}</span>
              </button>
            </div>
          ) : (
            /* Create new or Link existing */
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleCreateAutoSheet}
                disabled={isCreatingSheet || isConnectingGoogle}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-900/40 text-xs transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {isCreatingSheet
                    ? 'Creating Master Sheet in Google Drive...'
                    : '1-Click: Create Master Eco Tech AI Spreadsheet'}
                </span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[10px] text-slate-400 uppercase tracking-wider">
                  Or Link Existing Google Sheet
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste Google Sheet URL or ID..."
                  value={customSheetInput}
                  onChange={(e) => setCustomSheetInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleLinkExistingSheet}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Link
                </button>
              </div>
            </div>
          )}

          {/* Sync Structure Specs */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Where to find this data in your Google Sheets:</span>
            </div>
            <p>
              • <strong>Tab 1 ('User Logins'):</strong> Column A (Timestamp), Column B (Full Name), Column C (Email), Column D (Phone), Column E (Class/College), Column F (Session ID).
            </p>
            <p>
              • <strong>Tab 2 ('Community Feedback'):</strong> Column A (Timestamp), Column B (User Name), Column C (Email), Column D (Star Rating), Column E (Category), Column F (Eco Tip/Comment).
            </p>
          </div>

          {/* Quick In-App Data Preview Accordion */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> In-App Synced Data Preview
              </span>
              <span className="text-[10px] text-slate-400">Live records</span>
            </div>

            {/* Tab 1 Preview: Logins */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-emerald-300">Tab: 'User Logins'</span>
              <div className="overflow-x-auto max-h-36 bg-slate-950 rounded-lg border border-slate-800 p-2 text-[10px]">
                {(() => {
                  try {
                    const profileRaw = localStorage.getItem('eco_tech_user_profile_v1');
                    if (profileRaw) {
                      const p = JSON.parse(profileRaw);
                      return (
                        <div className="space-y-1">
                          <div className="text-slate-400 grid grid-cols-4 font-mono font-bold pb-1 border-b border-slate-800">
                            <span>Name</span>
                            <span>Email</span>
                            <span>Phone</span>
                            <span>College / Class</span>
                          </div>
                          <div className="grid grid-cols-4 text-slate-200 truncate py-0.5">
                            <span className="truncate">{p.name}</span>
                            <span className="truncate text-emerald-400">{p.email}</span>
                            <span className="truncate">{p.phone}</span>
                            <span className="truncate">{p.college}</span>
                          </div>
                        </div>
                      );
                    }
                  } catch (e) {}
                  return <p className="text-slate-500">No login records logged yet.</p>;
                })()}
              </div>
            </div>

            {/* Tab 2 Preview: Feedback */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-amber-300">Tab: 'Community Feedback'</span>
              <div className="overflow-x-auto max-h-40 bg-slate-950 rounded-lg border border-slate-800 p-2 text-[10px]">
                {(() => {
                  try {
                    const fbRaw = localStorage.getItem('eco_tech_community_feedbacks');
                    if (fbRaw) {
                      const list = JSON.parse(fbRaw);
                      return (
                        <div className="space-y-1.5">
                          <div className="text-slate-400 grid grid-cols-4 font-mono font-bold pb-1 border-b border-slate-800">
                            <span>User</span>
                            <span>Rating</span>
                            <span>Category</span>
                            <span>Tip / Suggestion</span>
                          </div>
                          {list.slice(0, 4).map((item: any, idx: number) => (
                            <div key={idx} className="grid grid-cols-4 text-slate-200 truncate py-0.5">
                              <span className="truncate">{item.name}</span>
                              <span className="text-amber-400 font-bold">{item.rating}★</span>
                              <span className="text-slate-400">{item.category}</span>
                              <span className="truncate text-slate-300">{item.comment}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch (e) {}
                  return <p className="text-slate-500">No community feedback recorded yet.</p>;
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
