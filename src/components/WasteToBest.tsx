import React, { useState, useRef } from 'react';
import { UpcyclingProject, WasteToBestResult } from '../types';
import { voiceAssistant } from '../utils/voiceAssistant';
import { CameraCaptureModal } from './CameraCaptureModal';
import {
  Sparkles,
  Camera,
  Upload,
  Volume2,
  VolumeX,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  Hammer,
  Clock,
  Award,
  RefreshCw,
  Lightbulb,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const COMMON_WASTE_ITEMS = [
  { name: 'Used Plastic Bottles', icon: '🧴', category: 'PET Plastics' },
  { name: 'Cardboard Delivery Boxes', icon: '📦', category: 'Corrugated Paper' },
  { name: 'Old Denim Jeans / T-Shirt', icon: '👖', category: 'Textiles' },
  { name: 'Empty Egg Cartons', icon: '🥚', category: 'Molded Pulp' },
  { name: 'Tin Food / Coffee Cans', icon: '🥫', category: 'Tinplate Steel' },
  { name: 'Glass Pasta Sauce Jars', icon: '🫙', category: 'Soda-Lime Glass' },
];

export const WasteToBest: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<WasteToBestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [savedProjectIds, setSavedProjectIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('eco_tech_saved_upcycles');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageCapture = (base64: string) => {
    setSelectedImage(base64);
    generateUpcycles(base64);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      generateUpcycles(base64);
    };
    reader.readAsDataURL(file);
  };

  const generateUpcycles = async (base64?: string, wasteDescription?: string) => {
    setIsProcessing(true);
    setError(null);
    voiceAssistant.stop();
    setIsSpeaking(false);

    try {
      const response = await fetch('/api/waste-to-best', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          wasteDescription,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate upcycling ideas.');
      }

      const res: WasteToBestResult = {
        ...data.data,
        imageUrl: base64,
      };

      setResult(res);
      if (res.projects?.length > 0) {
        setExpandedProjectId(res.projects[0].id);
      }

      if (res.voiceSummary && voiceAssistant.isVoiceSupported()) {
        voiceAssistant.speak(
          res.voiceSummary,
          () => setIsSpeaking(true),
          () => setIsSpeaking(false)
        );
      }
    } catch (err: any) {
      console.error('Waste to best error:', err);
      setError(err?.message || 'Error generating blueprints.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSaveProject = (projectId: string) => {
    setSavedProjectIds((prev) => {
      const updated = prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId];
      try {
        localStorage.setItem('eco_tech_saved_upcycles', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const toggleVoiceSpeech = () => {
    if (isSpeaking) {
      voiceAssistant.stop();
      setIsSpeaking(false);
    } else if (result?.voiceSummary) {
      voiceAssistant.speak(
        result.voiceSummary,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false)
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-center p-1.5 shadow-xl shadow-emerald-900/40 shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/logo_fitted.png"
                alt="Eco Tech AI Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Waste to Best Engine
                </span>
                <span className="text-xs text-slate-400">Column 3 of 4</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Trash into Treasure: Upcycling & Circular Blueprint
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl mt-1">
                Snap a picture of any household waste or discarded item. Our AI engineers creative,
                step-by-step DIY transformations that divert trash from landfills into valuable everyday products.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCameraOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-900/30 transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Waste Photo</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Upload Waste Image</span>
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

        {/* Preset Waste Items */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Or select a common household waste material to transform:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {COMMON_WASTE_ITEMS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  generateUpcycles(undefined, item.name);
                }}
                disabled={isProcessing}
                className="flex flex-col items-center p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700/60 hover:border-emerald-500/40 text-left transition group cursor-pointer disabled:opacity-50"
              >
                <span className="text-2xl mb-1 group-hover:scale-110 transition transform">
                  {item.icon}
                </span>
                <span className="text-xs font-semibold text-slate-200 text-center line-clamp-1">
                  {item.name}
                </span>
                <span className="text-[10px] text-emerald-400/80 font-mono mt-0.5">
                  {item.category}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isProcessing && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-10 text-center shadow-xl animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mx-auto mb-4">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            Synthesizing Trash-to-Treasure Blueprints...
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Formulating structural modifications, cutting guides, required household tools, and
            circular utility metrics.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-950/70 border border-red-500/40 rounded-xl text-red-200 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs underline text-red-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upcycling Result Showcase */}
      {result && !isProcessing && (
        <div className="space-y-6">
          {/* Header Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {result.imageUrl ? (
                <img
                  src={result.imageUrl}
                  alt={result.detectedWaste}
                  className="w-16 h-16 rounded-xl object-cover border border-emerald-500/30 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl shrink-0">
                  ✨
                </div>
              )}
              <div>
                <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                  Target Material Detected
                </span>
                <h3 className="text-xl font-bold text-white">{result.detectedWaste}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>
                    Treasure Potential:{' '}
                    <strong className="text-emerald-300">{result.treasurePotential}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Landfill Diverted:{' '}
                    <strong className="text-teal-300">{result.divertedWasteWeight}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Voice Readout Toggle */}
            <button
              onClick={toggleVoiceSpeech}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isSpeaking
                  ? 'bg-emerald-500 text-slate-950 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isSpeaking ? 'Stop Voice' : 'Listen to Upcycle Concept'}</span>
            </button>
          </div>

          {/* Blueprint Cards */}
          <div className="grid grid-cols-1 gap-4">
            {result.projects.map((project, index) => {
              const isExpanded = expandedProjectId === project.id;
              const isSaved = savedProjectIds.includes(project.id);

              return (
                <div
                  key={project.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition hover:border-slate-700"
                >
                  {/* Project Header Bar */}
                  <div
                    onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer bg-slate-900/80 hover:bg-slate-800/50 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 shrink-0">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700 uppercase">
                            {project.utilityType}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              project.difficulty === 'Easy'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                                : project.difficulty === 'Intermediate'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                                : 'bg-purple-950/80 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {project.difficulty}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" /> {project.estimatedTime}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-white mt-1">{project.title}</h4>
                        <p className="text-xs text-slate-400">{project.tagline}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          Treasure Index
                        </span>
                        <div className="text-lg font-extrabold text-emerald-400 font-mono">
                          {project.treasureScore}/100
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveProject(project.id);
                        }}
                        className={`p-2.5 rounded-xl border transition cursor-pointer ${
                          isSaved
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                        title={isSaved ? 'Saved to your DIY projects' : 'Bookmark this DIY project'}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-4 h-4" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>

                      <div className="p-2 text-slate-400">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Blueprint Details */}
                  {isExpanded && (
                    <div className="p-6 border-t border-slate-800 bg-slate-950/40 space-y-5 animate-fade-in">
                      {/* Sustainability Benefit Callout */}
                      <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2.5">
                        <Award className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <strong className="text-white">Eco Impact: </strong>
                          {project.sustainabilityBenefit}
                        </div>
                      </div>

                      {/* Materials & Tools */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                          <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-emerald-400" /> Materials Needed
                          </h5>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {project.materialsNeeded.map((mat, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span>{mat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                          <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Hammer className="w-3.5 h-3.5 text-amber-400" /> Household Tools
                          </h5>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {project.tools.map((tool, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span>{tool}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Step-by-Step Instructions */}
                      <div>
                        <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                          Step-by-Step DIY Execution:
                        </h5>
                        <div className="space-y-2.5">
                          {project.steps.map((step, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200"
                            >
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                                {idx + 1}
                              </div>
                              <span className="leading-relaxed">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleImageCapture}
        title="Waste to Best: Capture Trash Item"
      />
    </div>
  );
};
