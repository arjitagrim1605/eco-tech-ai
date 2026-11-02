import React, { useState, useRef } from 'react';
import { ObjectAnalysisResult } from '../types';
import { voiceAssistant } from '../utils/voiceAssistant';
import { CameraCaptureModal } from './CameraCaptureModal';
import {
  Camera,
  Upload,
  Volume2,
  VolumeX,
  Mic,
  AlertTriangle,
  Recycle,
  Sparkles,
  Clock,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Bot,
  User,
  Radio,
} from 'lucide-react';

interface EcoScannerProps {
  onAskChatFollowUp?: (prompt: string, contextItem: ObjectAnalysisResult) => void;
}

const PRESET_ITEMS = [
  {
    name: 'Plastic Water Bottle',
    badge: 'PET #1',
    description: 'Single-use polyethylene terephthalate container',
    icon: '🧴',
  },
  {
    name: 'Fresh Banana Peel',
    badge: 'Organic',
    description: 'Natural post-consumer organic fruit waste',
    icon: '🍌',
  },
  {
    name: 'Expanded Polystyrene Cup',
    badge: 'Styrofoam #6',
    description: 'Petroleum-based expanded synthetic foam',
    icon: '☕',
  },
  {
    name: 'Aluminum Soda Can',
    badge: 'Alloy Metal',
    description: 'Infinitely recyclable non-ferrous metal container',
    icon: '🥤',
  },
  {
    name: 'Tetra Pak Juice Carton',
    badge: 'Multi-layer',
    description: 'Aseptic composite paperboard, PE, and aluminum foil',
    icon: '🧃',
  },
  {
    name: 'Cardboard Shipping Box',
    badge: 'Corrugated',
    description: 'Kraft pulp cellulose fiber packaging',
    icon: '📦',
  },
];

// Client-side image compression helper to avoid large payload timeouts
const compressImage = (dataUrl: string, maxDimension = 800, quality = 0.82): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export const EcoScanner: React.FC<EcoScannerProps> = ({ onAskChatFollowUp }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ObjectAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Voice Assistant states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceQueryText, setVoiceQueryText] = useState<string>('');
  const [voiceAnswerText, setVoiceAnswerText] = useState<string>('');
  const [isAnsweringVoice, setIsAnsweringVoice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageSelected = async (base64: string) => {
    setSelectedImage(base64);
    await analyzeImage(base64);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await handleImageSelected(base64);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64?: string, itemName?: string) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    voiceAssistant.stop();
    setIsSpeaking(false);
    setVoiceAnswerText('');
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      let preparedImage = base64;
      if (base64) {
        preparedImage = await compressImage(base64, 800, 0.82);
      }

      // Allow time for image analysis and a temporary retry.
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch('/api/analyze-object', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: preparedImage,
          itemName,
        }),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || 'Failed to analyze object.');
      }

      const result: ObjectAnalysisResult = {
        ...(data.data || data),
        imageUrl: base64,
        analyzedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setAnalysisResult(result);

      // Auto-narrate voice summary if available
      if (result.voiceSummary && voiceAssistant.isVoiceSupported()) {
        voiceAssistant.speak(
          result.voiceSummary,
          () => setIsSpeaking(true),
          () => setIsSpeaking(false)
        );
      }
    } catch (err: any) {
      console.warn('Object analysis failed:', err);
      setError(err.name === 'AbortError'
        ? 'The image analysis took too long. Please try again with a smaller or clearer photo.'
        : err.message || 'Could not analyze this image. Please try again with a clearer photo.');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  const handleTestPreset = (presetName: string) => {
    setSelectedImage(null);
    analyzeImage(undefined, presetName);
  };

  const toggleVoiceSpeech = () => {
    if (isSpeaking) {
      voiceAssistant.stop();
      setIsSpeaking(false);
    } else if (analysisResult?.voiceSummary) {
      voiceAssistant.speak(
        analysisResult.voiceSummary,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false)
      );
    }
  };

  // Direct Voice Assistant Query on the Scanner page
  const handleStartVoiceAsk = () => {
    setIsListeningVoice(true);
    setVoiceAnswerText('');
    voiceAssistant.stop();
    setIsSpeaking(false);

    voiceAssistant.startListening(
      async (transcript) => {
        setIsListeningVoice(false);
        setVoiceQueryText(transcript);
        await answerVoiceQuestion(transcript);
      },
      () => setIsListeningVoice(true),
      () => setIsListeningVoice(false),
      (err) => {
        setIsListeningVoice(false);
        console.warn('Speech rec error:', err);
      }
    );
  };

  const answerVoiceQuestion = async (query: string) => {
    setIsAnsweringVoice(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          currentContext: analysisResult
            ? {
                objectName: analysisResult.objectName,
                category: analysisResult.category,
                biodegradable: analysisResult.isBiodegradable,
                disposalBin: analysisResult.disposalGuide.recommendedBin,
              }
            : undefined,
        }),
      });

      const data = await response.json();
      const reply = data.reply || 'You should clean and sort this item into the appropriate recycling bin.';
      setVoiceAnswerText(reply);

      // Speak answer aloud
      if (voiceAssistant.isVoiceSupported()) {
        voiceAssistant.speak(
          reply,
          () => setIsSpeaking(true),
          () => setIsSpeaking(false)
        );
      }
    } catch (err: any) {
      const fallbackReply = `For ${analysisResult?.objectName || 'this item'}, rinse it clean and deposit in the ${
        analysisResult?.disposalGuide.recommendedBin || 'recycling bin'
      }.`;
      setVoiceAnswerText(fallbackReply);
      if (voiceAssistant.isVoiceSupported()) {
        voiceAssistant.speak(
          fallbackReply,
          () => setIsSpeaking(true),
          () => setIsSpeaking(false)
        );
      }
    } finally {
      setIsAnsweringVoice(false);
    }
  };

  // Bin color helper
  const getBinStyle = (color: string) => {
    switch (color?.toLowerCase()) {
      case 'blue':
        return 'bg-blue-600/20 text-blue-300 border-blue-500/40';
      case 'green':
        return 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40';
      case 'yellow':
        return 'bg-amber-600/20 text-amber-300 border-amber-500/40';
      case 'red':
        return 'bg-rose-600/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400 stroke-emerald-500';
    if (score >= 40) return 'text-amber-400 stroke-amber-500';
    return 'text-rose-400 stroke-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Area with Official Logo */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-center p-1.5 shadow-xl shadow-emerald-900/40 shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/logo_fitted.png"
                alt="Eco Tech AI Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Eco Channel
                </span>
                <span className="text-xs text-slate-400">Column 1 of 4</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                AI Object & Biodegradability Scanner
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1">
                Capture or upload any item. Our computer vision AI identifies the exact material,
                calculates biodegradability index, evaluates toxicity, and provides voice-guided disposal.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsCameraOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/30 transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Photo</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Upload Image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* Dedicated Interactive Voice Assistant Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition ${
                  isSpeaking
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/50 animate-pulse'
                    : isListeningVoice
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 animate-bounce'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Eco Voice Assistant
                  </h4>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded-full">
                    {isSpeaking ? 'Narrating Audio' : isListeningVoice ? 'Listening...' : 'Active'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Speak questions about any scanned object to receive instant spoken answers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleStartVoiceAsk}
                disabled={isListeningVoice || isAnalyzing}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isListeningVoice
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>{isListeningVoice ? 'Listening... Speak Now' : 'Ask Voice Assistant'}</span>
              </button>

              {analysisResult && (
                <button
                  type="button"
                  onClick={toggleVoiceSpeech}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  title="Toggle result readout"
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{isSpeaking ? 'Stop Voice' : 'Hear Result'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Voice Interaction History / Response Card */}
          {(voiceQueryText || voiceAnswerText || isAnsweringVoice) && (
            <div className="mt-3 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2 animate-fade-in">
              {voiceQueryText && (
                <div className="flex items-start gap-2 text-slate-300">
                  <User className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">You asked:</strong> "{voiceQueryText}"
                  </span>
                </div>
              )}

              {isAnsweringVoice ? (
                <div className="flex items-center gap-2 text-emerald-400 text-xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Eco Voice Assistant is thinking and formulating spoken answer...</span>
                </div>
              ) : voiceAnswerText ? (
                <div className="flex items-start gap-2 text-emerald-300 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/20">
                  <Bot className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{voiceAnswerText}</span>
                </div>
              ) : null}
            </div>
          )}

          {/* Quick 1-Click Preset Items */}
          <div className="mt-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Or test common materials with 1 click:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {PRESET_ITEMS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleTestPreset(item.name)}
                  disabled={isAnalyzing}
                  className="flex flex-col items-center p-2.5 rounded-2xl bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700/60 hover:border-emerald-500/40 text-left transition group cursor-pointer disabled:opacity-50"
                >
                  <span className="text-2xl mb-1 group-hover:scale-110 transition transform">
                    {item.icon}
                  </span>
                  <span className="text-xs font-semibold text-slate-200 text-center line-clamp-1">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-emerald-400/90 font-mono mt-0.5">
                    {item.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isAnalyzing && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-10 text-center shadow-xl animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mx-auto mb-4">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            Analyzing Molecular & Ecological Profile...
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Detecting polymer compositions, decomposition half-life, microplastic threat potential,
            and municipal sorting protocols.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-950/70 border border-red-500/40 rounded-2xl text-red-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs underline text-red-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Result Card */}
      {analysisResult && !isAnalyzing && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden divide-y divide-slate-800 animate-fade-in">
          {/* Top Result Bar */}
          <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              {analysisResult.imageUrl ? (
                <img
                  src={analysisResult.imageUrl}
                  alt={analysisResult.objectName}
                  className="w-20 h-20 rounded-2xl object-cover border border-emerald-500/30 shrink-0 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl shrink-0">
                  🌱
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {analysisResult.category}
                  </span>
                  <span className="text-xs text-slate-400">
                    Analyzed at {analysisResult.analyzedAt}
                  </span>
                  {analysisResult.identificationConfidence && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      analysisResult.identificationConfidence === 'high'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : analysisResult.identificationConfidence === 'medium'
                        ? 'bg-amber-950 text-amber-200 border-amber-700'
                        : 'bg-rose-950 text-rose-200 border-rose-700'
                    }`}>
                      {analysisResult.identificationConfidence} confidence
                    </span>
                  )}
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {analysisResult.objectName}
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  {analysisResult.environmentalImpact.summary}
                </p>
                {analysisResult.uncertaintyNotes && analysisResult.identificationConfidence !== 'high' && (
                  <p className="text-xs text-amber-200 mt-2 max-w-xl">
                    Uncertain: {analysisResult.uncertaintyNotes}
                  </p>
                )}
              </div>
            </div>

            {/* Voice Assistant Pill & Query */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <button
                onClick={toggleVoiceSpeech}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isSpeaking
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-750 text-emerald-300 border border-emerald-500/30'
                }`}
                title="Voice Assistant narration"
              >
                {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{isSpeaking ? 'Stop Voice' : 'Listen to Voice'}</span>
              </button>

              <button
                onClick={handleStartVoiceAsk}
                disabled={isListeningVoice}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isListeningVoice
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
                }`}
                title="Ask question with voice"
              >
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>{isListeningVoice ? 'Listening...' : 'Voice Ask'}</span>
              </button>
            </div>
          </div>

          {/* Metric Row: Biodegradability vs Harmfulness vs Decomposition */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            {/* 1. Biodegradability Score */}
            <div className="p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Biodegradability Index
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    analysisResult.isBiodegradable
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {analysisResult.isBiodegradable ? 'Biodegradable' : 'Non-Biodegradable'}
                </span>
              </div>

              <div className="flex items-center gap-4 my-2">
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={getScoreColor(analysisResult.biodegradabilityScore)}
                      strokeDasharray={`${analysisResult.biodegradabilityScore}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-white font-mono">
                    {analysisResult.biodegradabilityScore}%
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    {analysisResult.biodegradabilityScore >= 70
                      ? 'High Natural Breakdown'
                      : analysisResult.biodegradabilityScore >= 35
                      ? 'Slow / Partial Breakdown'
                      : 'Persistent Synthetic'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Microorganisms {analysisResult.isBiodegradable ? 'can readily' : 'cannot safely'} digest this material.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Decomposition Time */}
            <div className="p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Decomposition Duration
                </span>
              </div>

              <div className="my-2">
                <div className="text-2xl font-extrabold text-white font-mono tracking-tight text-emerald-400">
                  {analysisResult.decompositionTime}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Time required under natural soil or marine exposure to disintegrate.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-300">
                Carbon impact: {analysisResult.environmentalImpact.carbonFootprint}
              </div>
            </div>

            {/* 3. Harm Level & Environmental Hazard */}
            <div className="p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Eco Harmfulness
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    analysisResult.environmentalImpact.harmLevel === 'Critical'
                      ? 'bg-rose-500 text-white font-bold'
                      : analysisResult.environmentalImpact.harmLevel === 'High'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : analysisResult.environmentalImpact.harmLevel === 'Moderate'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {analysisResult.environmentalImpact.harmLevel} Hazard
                </span>
              </div>

              <div className="space-y-1.5 my-1 text-xs">
                <div className="text-slate-300">
                  <span className="font-semibold text-slate-400">Microplastics: </span>
                  {analysisResult.environmentalImpact.microplasticRisk}
                </div>
                <div className="text-slate-300">
                  <span className="font-semibold text-slate-400">Wildlife Threat: </span>
                  {analysisResult.environmentalImpact.oceanSoilThreat}
                </div>
              </div>
            </div>
          </div>

          {/* Precision Disposal Guide */}
          <div className="p-6 sm:p-8 bg-slate-950/40">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Recycle className="w-4 h-4 text-emerald-400" />
              How to Dispose of This Object Correctly
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recommended Receptacle */}
              <div className="space-y-3">
                <div
                  className={`p-4 rounded-2xl border flex items-center gap-3 ${getBinStyle(
                    analysisResult.disposalGuide.binColor
                  )}`}
                >
                  <Trash2 className="w-7 h-7 shrink-0" />
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                      Designated Bin
                    </span>
                    <p className="text-base font-bold text-white">
                      {analysisResult.disposalGuide.recommendedBin}
                    </p>
                  </div>
                </div>

                {/* Compatibility Badges */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div
                    className={`p-2 rounded-xl border ${
                      analysisResult.disposalGuide.recyclable
                        ? 'bg-blue-900/30 border-blue-500/40 text-blue-200'
                        : 'bg-slate-800/40 border-slate-700 text-slate-500'
                    }`}
                  >
                    <span className="block font-bold">
                      {analysisResult.disposalGuide.recyclable ? '✓ Yes' : '✕ No'}
                    </span>
                    <span className="text-[10px]">Recyclable</span>
                  </div>

                  <div
                    className={`p-2 rounded-xl border ${
                      analysisResult.disposalGuide.compostable
                        ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-800/40 border-slate-700 text-slate-500'
                    }`}
                  >
                    <span className="block font-bold">
                      {analysisResult.disposalGuide.compostable ? '✓ Yes' : '✕ No'}
                    </span>
                    <span className="text-[10px]">Compostable</span>
                  </div>

                  <div
                    className={`p-2 rounded-xl border ${
                      analysisResult.disposalGuide.hazardous
                        ? 'bg-rose-900/30 border-rose-500/40 text-rose-200 font-bold'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span className="block font-bold">
                      {analysisResult.disposalGuide.hazardous ? '⚠️ Yes' : 'No'}
                    </span>
                    <span className="text-[10px]">Hazardous</span>
                  </div>
                </div>
              </div>

              {/* Prep Steps */}
              <div className="lg:col-span-2 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Preparation & Sorting Protocol:
                </p>
                <div className="space-y-2">
                  {analysisResult.disposalGuide.prepSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs text-slate-200"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                {analysisResult.disposalGuide.specialInstructions && (
                  <p className="text-xs text-amber-300/90 bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-xl">
                    ⚠️ {analysisResult.disposalGuide.specialInstructions}
                  </p>
                )}
              </div>
            </div>

            {/* Eco Alternatives & Follow up */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Green Alternatives:</span>
                {analysisResult.ecoAlternatives?.map((alt, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300"
                  >
                    🌿 {alt}
                  </span>
                ))}
              </div>

              {onAskChatFollowUp && (
                <button
                  type="button"
                  onClick={() =>
                    onAskChatFollowUp(
                      `How can I reduce waste from ${analysisResult.objectName} and are there local recycling rules for it?`,
                      analysisResult
                    )
                  }
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold self-start sm:self-auto cursor-pointer"
                >
                  <span>Ask Chat Assistant about this item</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleImageSelected}
        title="Eco Scanner: Capture Object Photo"
      />
    </div>
  );
};
