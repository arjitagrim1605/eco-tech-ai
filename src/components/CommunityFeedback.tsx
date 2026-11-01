import React, { useState } from 'react';
import { FeedbackItem, UserProfile } from '../types';
import { StarReviewModal } from './StarReviewModal';
import {
  Star,
  MessageSquare,
  ThumbsUp,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';

interface CommunityFeedbackProps {
  userProfile: UserProfile | null;
  onRecordFeedbackToSheet: (
    feedback: FeedbackItem
  ) => Promise<{ success: boolean; error?: string }>;
  isSheetSynced: boolean;
  spreadsheetUrl?: string | null;
  onOpenSheetModal?: () => void;
}

export const CommunityFeedback: React.FC<CommunityFeedbackProps> = ({
  userProfile,
  onRecordFeedbackToSheet,
  spreadsheetUrl,
  onOpenSheetModal,
}) => {
  const isAdmin = userProfile?.email?.toLowerCase() === 'arjitagrim1605@gmail.com';

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(() => {
    try {
      const saved = localStorage.getItem('eco_tech_community_feedbacks');
      if (saved) {
        const parsed = JSON.parse(saved);
        const realOnes = parsed.filter(
          (item: any) =>
            item.id &&
            !item.id.startsWith('fb-1') &&
            !item.id.startsWith('fb-2') &&
            !item.id.startsWith('fb-3') &&
            !item.id.startsWith('fb-4')
        );
        return realOnes;
      }
    } catch (e) {}
    return [];
  });

  const [category, setCategory] = useState<'Tip' | 'Suggestion' | 'Idea' | 'Appreciation'>('Tip');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [lastSubmittedFeedback, setLastSubmittedFeedback] = useState<FeedbackItem | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Load verified community feedback from server on mount
  React.useEffect(() => {
    fetch('/api/feedbacks')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.feedbacks)) {
          setFeedbacks(data.feedbacks);
          try {
            localStorage.setItem('eco_tech_community_feedbacks', JSON.stringify(data.feedbacks));
          } catch (e) {}
        }
      })
      .catch((err) => console.warn('Could not fetch server feedbacks:', err));
  }, []);

  // Sync to localStorage
  const saveFeedbacks = (list: FeedbackItem[]) => {
    setFeedbacks(list);
    try {
      localStorage.setItem('eco_tech_community_feedbacks', JSON.stringify(list));
    } catch (e) {}
  };

  // Metrics computation
  const totalReviews = feedbacks.length;
  const averageRating =
    totalReviews > 0
      ? (feedbacks.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews).toFixed(1)
      : '5.0';

  const ratingCounts = {
    5: feedbacks.filter((f) => f.rating === 5).length,
    4: feedbacks.filter((f) => f.rating === 4).length,
    3: feedbacks.filter((f) => f.rating === 3).length,
    2: feedbacks.filter((f) => f.rating === 2).length,
    1: feedbacks.filter((f) => f.rating === 1).length,
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    setSyncStatus(null);

    const newFeedback: FeedbackItem = {
      id: `review-${Date.now()}`,
      name: userProfile?.name || 'Community Member',
      email: userProfile?.email || 'member@ecotech.community',
      rating,
      category,
      comment: comment.trim(),
      upvotes: 0,
      timestamp: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };

    let savedOnServer = false;
    let syncedToSheet = false;
    try {
      const response = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeedback),
      });
      const data = await response.json();
      if (response.ok && data.success && data.feedback) {
        savedOnServer = true;
        syncedToSheet = data.syncedToSheet === true;
        setFeedbacks((prev) => [data.feedback, ...prev.filter((f) => f.id !== data.feedback.id)]);
      }
    } catch (err) {
      console.warn('Server feedback post warning:', err);
    }

    const updated = [newFeedback, ...feedbacks];
    saveFeedbacks(updated);
    setLastSubmittedFeedback(newFeedback);

    // The server syncs all public feedback. The admin browser remains a fallback
    // when the server-side Sheets connection is not configured or temporarily down.
    if (isAdmin && !syncedToSheet) {
      try {
        const syncRes = await onRecordFeedbackToSheet(newFeedback);
        if (syncRes.success) {
          syncedToSheet = true;
          setSyncStatus({
            type: 'success',
            message: 'Feedback submitted & appended to Google Sheet (Tab: "Community Feedback")!',
          });
        } else {
          setSyncStatus({
            type: 'warning',
            message:
              syncRes.error === 'No Google Sheet linked'
                ? 'Saved in app! Please link your Google Sheet so data writes directly to your account.'
                : `Saved in app! (${syncRes.error})`,
          });
        }
      } catch (err: any) {
        setSyncStatus({
          type: 'warning',
          message: 'Saved in app! Google Sheets sync will retry once re-connected.',
        });
      }
    } else if (syncedToSheet) {
      setSyncStatus({
        type: 'success',
        message: 'Thank you! Your feedback has been shared with the community and added to the Eco Tech AI sheet.',
      });
    } else if (savedOnServer) {
      setSyncStatus({
        type: 'warning',
        message: 'Thank you! Your feedback is saved for the community. Spreadsheet sync is pending; the admin can sync it from the admin panel.',
      });
    } else {
      setSyncStatus({
        type: 'warning',
        message: 'Your feedback could not be saved. Please try again.',
      });
    }

    setIsSubmitting(false);
    setComment('');

    // Trigger 5-star review modal
    setShowReviewModal(true);
  };

  const handleModalReviewCompleted = async (
    finalRating: number,
    reviewText: string,
    recommendation: string
  ) => {
    if (lastSubmittedFeedback) {
      const updated = feedbacks.map((f) =>
        f.id === lastSubmittedFeedback.id
          ? {
              ...f,
              rating: finalRating,
              comment: reviewText ? `${f.comment} [Note: ${reviewText}]` : f.comment,
            }
          : f
      );
      saveFeedbacks(updated);

      if (isAdmin) {
        const syncRes = await onRecordFeedbackToSheet({
          ...lastSubmittedFeedback,
          rating: finalRating,
          comment: `${lastSubmittedFeedback.comment} (Recommended: ${recommendation})`,
        });

        if (syncRes.success) {
          setSyncStatus({
            type: 'success',
            message: 'Review & 5-Star Rating successfully saved and updated in Google Sheets!',
          });
        }
      }
    }
  };

  const handleUpvote = (id: string) => {
    fetch('/api/feedbacks/upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch((e) => console.warn('Upvote error:', e));

    const updated = feedbacks.map((f) => (f.id === id ? { ...f, upvotes: f.upvotes + 1 } : f));
    saveFeedbacks(updated);
  };

  const filteredFeedbacks = feedbacks.filter((item) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Tips') return item.category === 'Tip';
    if (activeFilter === 'Suggestions') return item.category === 'Suggestion' || item.category === 'Idea';
    if (activeFilter === 'Reviews') return item.rating >= 4;
    return true;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. TOP SECTION: Share Your Thought or Eco Tip (Prominent & Clean) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-center p-1.5 shadow-xl shadow-emerald-900/40 shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/logo_fitted.png"
                alt="Eco Tech AI Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Eco Tech Community
                </span>
                <span className="text-xs text-slate-400">Column 4 of 4</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Share Your Thought or Eco Tip
              </h2>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                Have an innovative zero-waste idea, campus recycling trick, or feedback for the Eco Tech AI team? Share it below to inspire the community.
              </p>
            </div>
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncStatus && (
          <div
            className={`mb-6 p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 animate-fade-in ${
              syncStatus.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/80 border border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {syncStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{syncStatus.message}</span>
            </div>

            {/* ONLY visible to admin Arjit - completely hidden from Pooja and others */}
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>Open Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {syncStatus.type !== 'success' && onOpenSheetModal && (
                  <button
                    type="button"
                    onClick={onOpenSheetModal}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold transition cursor-pointer"
                  >
                    Link Sheet Now
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Feedback Submission Form */}
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Feedback Type / Category
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(['Tip', 'Suggestion', 'Idea', 'Appreciation'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition cursor-pointer text-left flex items-center gap-2 ${
                      category === cat
                        ? 'bg-emerald-600 border-emerald-500 text-white font-semibold shadow-md shadow-emerald-900/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750'
                    }`}
                  >
                    <span>
                      {cat === 'Tip' && '🌿'}
                      {cat === 'Suggestion' && '💡'}
                      {cat === 'Idea' && '🚀'}
                      {cat === 'Appreciation' && '❤️'}
                    </span>
                    <span>
                      {cat === 'Tip' && 'Eco Tip'}
                      {cat === 'Suggestion' && 'Suggestion'}
                      {cat === 'Idea' && 'Upcycle Idea'}
                      {cat === 'Appreciation' && 'Appreciation'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Rating Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Your Experience Rating
              </label>
              <div className="flex items-center gap-2 bg-slate-800/80 p-3 rounded-xl border border-slate-700 justify-around">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer transition transform hover:scale-125 focus:outline-none"
                    title={`${star} Star`}
                  >
                    <Star
                      className={`w-8 h-8 transition ${
                        rating >= star
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                          : 'fill-transparent text-slate-600 hover:text-slate-400'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-amber-400/90 font-medium text-right mt-1.5">
                {rating === 5 && '★★★★★ Excellent'}
                {rating === 4 && '★★★★☆ Very Good'}
                {rating === 3 && '★★★☆☆ Good'}
                {rating === 2 && '★★☆☆☆ Needs Improvement'}
                {rating === 1 && '★☆☆☆☆ Poor'}
              </p>
            </div>
          </div>

          {/* Comment / Suggestion */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Your Eco-Friendly Tip or Thought:
            </label>
            <textarea
              required
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share a sustainability trick, zero-waste habit, upcycling tip, or suggestion for Eco Tech AI..."
              className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 leading-relaxed shadow-inner"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Posting as <strong className="text-white">{userProfile?.name || 'Community Member'}</strong>
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !comment.trim()}
              className="py-3 px-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/40 transition cursor-pointer flex items-center justify-center gap-2 self-end sm:self-auto"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Thought & Eco Tip'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. BOTTOM SECTION: Community Eco Hub & 5-Star Reviews */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              Community Eco Hub & 5-Star Reviews
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified community suggestions and authentic ratings
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {['All', 'Tips', 'Suggestions', 'Reviews'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeFilter === f
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Live Rating Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Average Rating Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-5 shadow-lg">
            <div className="text-center shrink-0 pr-4 border-r border-slate-800">
              <div className="text-4xl font-extrabold text-amber-400 tracking-tight font-mono">
                {averageRating}
              </div>
              <div className="flex items-center justify-center gap-0.5 mt-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">out of 5.0 stars</span>
            </div>

            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map((score) => {
                const count = ratingCounts[score as keyof typeof ratingCounts];
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={score} className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-3 font-semibold">{score}★</span>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-5 text-right font-mono text-slate-300">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Community Contributions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Total Reviews & Community Tips
              </span>
              <div className="text-3xl font-extrabold text-white font-mono mt-1">
                {totalReviews}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Authentic submissions from active participants
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Community Submissions Feed */}
        <div className="space-y-3">
          {filteredFeedbacks.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                🌿
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                No Community Reviews Yet
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Be the first to share an eco tip or thoughts with the Eco Tech AI community using the form above!
              </p>
            </div>
          ) : (
            filteredFeedbacks.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg hover:border-slate-700 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold flex items-center justify-center text-xs shadow-md">
                      {item.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700 uppercase font-mono">
                          {item.category}
                        </span>
                        <span>•</span>
                        <span>{item.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex items-center gap-0.5 text-amber-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-750">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                    <span className="text-xs font-mono font-bold ml-1 text-slate-200">
                      {item.rating}.0
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed pl-12">{item.comment}</p>

                {/* Footer with upvote button */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 pl-12">
                  <button
                    onClick={() => handleUpvote(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-emerald-950/80 hover:text-emerald-300 border border-slate-700 transition cursor-pointer"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Helpful ({item.upvotes})</span>
                  </button>

                  <span className="text-[10px] text-slate-500">Verified Submission</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5-Star Review Pop-up Modal */}
      <StarReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmitReview={handleModalReviewCompleted}
        initialRating={rating}
        userName={userProfile?.name}
      />
    </div>
  );
};
