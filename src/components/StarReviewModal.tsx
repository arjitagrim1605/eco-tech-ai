import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Star, X, Check, Heart, Sparkles, Send } from 'lucide-react';

interface StarReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview: (rating: number, reviewText: string, recommendation: string) => void;
  initialRating?: number;
  userName?: string;
}

export const StarReviewModal: React.FC<StarReviewModalProps> = ({
  isOpen,
  onClose,
  onSubmitReview,
  initialRating = 5,
  userName = 'Eco Advocate',
}) => {
  const [rating, setRating] = useState<number>(initialRating);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [recommendation, setRecommendation] = useState<'Definitely' | 'Likely' | 'Maybe'>('Definitely');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleStarClick = (score: number) => {
    setRating(score);
    // Trigger celebratory small burst
    confetti({
      particleCount: 25,
      spread: 40,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#f59e0b'],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);

    // Full celebratory confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.5 },
      colors: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#f59e0b'],
    });

    onSubmitReview(
      rating,
      reviewText.trim() || 'Great experience with Eco Tech AI sustainability tools!',
      recommendation
    );

    setTimeout(() => {
      onClose();
      setIsSubmitted(false);
    }, 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden text-center p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSubmitted ? (
          <div>
            <div className="w-18 h-18 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-center p-2 shadow-xl shadow-emerald-900/40 mx-auto mb-3 overflow-hidden">
              <img
                src="/assets/aistudio/logo_fitted.png"
                alt="Eco Tech AI Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Feedback Submitted Successfully!</span>
            </div>

            <h3 className="text-2xl font-bold text-white tracking-tight">
              Rate Your Experience with Eco Tech AI
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
              Hi {userName}, how would you rate the accuracy, biodegradability analysis, and Waste-to-Best ideas?
            </p>

            {/* Interactive 5 Star Bar */}
            <div className="my-6 flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating !== null ? hoverRating : rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => handleStarClick(star)}
                    className="p-1 transition transform hover:scale-125 cursor-pointer focus:outline-none"
                    title={`${star} Star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-9 h-9 transition ${
                        active
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                          : 'fill-transparent text-slate-600 hover:text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="text-sm font-bold text-amber-400 mb-6">
              {rating === 5 && '★★★★★ Excellent! (5 out of 5 Stars)'}
              {rating === 4 && '★★★★☆ Very Good! (4 out of 5 Stars)'}
              {rating === 3 && '★★★☆☆ Good / Helpful (3 out of 5 Stars)'}
              {rating === 2 && '★★☆☆☆ Needs Improvement (2 out of 5 Stars)'}
              {rating === 1 && '★☆☆☆☆ Poor (1 out of 5 Stars)'}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Would you recommend Eco Tech AI to classmates & colleagues?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Definitely', 'Likely', 'Maybe'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setRecommendation(opt)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                        recommendation === opt
                          ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Additional Review Note (Optional):
                </label>
                <textarea
                  rows={2}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="e.g. Loved the instant biodegradability score and voice feedback!"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-900/40 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit 5-Star Rating</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="py-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mx-auto animate-bounce">
              <Check className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-white">Thank You for Your Rating!</h3>
            <p className="text-sm text-slate-300">
              Your {rating}-star review and thoughts have been recorded and synced to Google Sheets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
