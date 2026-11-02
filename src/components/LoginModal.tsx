import React, { useState } from 'react';
import { UserProfile } from '../types';
import { googleSignIn } from '../services/firebaseAuth';
import { Leaf, Sparkles, Building2, User, Mail, Phone, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (profile: UserProfile, googleAccessToken?: string) => void;
  defaultEmail?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onLoginSuccess,
  defaultEmail = '',
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStandardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your contact phone number.');
      return;
    }
    if (!college.trim()) {
      setError('Please enter your class, college, or institution.');
      return;
    }

    const profile: UserProfile = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      college: college.trim(),
      loginAt: new Date().toISOString(),
      isGoogleLinked: false,
    };

    onLoginSuccess(profile);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await googleSignIn(true, false);
      if (result) {
        const gUser = result.user;
        const profile: UserProfile = {
          name: name.trim() || gUser.displayName || 'Eco Advocate',
          email: gUser.email || email.trim() || defaultEmail,
          phone: phone.trim() || gUser.phoneNumber || '',
          college: college.trim(),
          loginAt: new Date().toISOString(),
          isGoogleLinked: true,
          googlePhotoUrl: gUser.photoURL || undefined,
        };
        onLoginSuccess(profile, result.accessToken);
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(err?.message || 'Google Sign-In was cancelled or failed. You can sign in using the profile form below.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Glow Header */}
        <div className="relative bg-gradient-to-r from-emerald-900/80 via-teal-900/60 to-slate-900 px-6 py-6 border-b border-emerald-500/20">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-13 h-13 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-center p-1 shadow-lg shadow-emerald-900/40 shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/logo_fitted.png"
                alt="Eco Tech AI Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Eco Tech AI</h2>
                <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  v2.0 Advanced
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Environmental Intelligence & Waste-to-Treasure Platform
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            Welcome! Please enter your user details to access the AI Eco Channel, Upcycle Engine, and Voice Assistant.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-emerald-100/80">
            When you sign in, your name, email, contact number, class or college, and login time are added to the Eco Tech AI Google Sheet. Passwords are never collected or stored.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-red-950/80 border border-red-500/40 text-red-200 flex items-center gap-2">
              <span className="text-red-400">⚠️</span> {error}
            </div>
          )}

          {/* Quick Google Sign In */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-300 mb-3 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Sign in with Google. Your profile details are recorded in the Eco Tech AI sheet.
            </p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-800 font-medium rounded-lg shadow transition duration-200 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoading ? 'Connecting Google Account...' : 'Sign in with Google (Fast Sync)'}</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-700 w-full" />
            <span className="bg-slate-900 px-3 text-xs text-slate-400 uppercase tracking-wider">
              Or Enter Details Manually
            </span>
            <div className="border-t border-slate-700 w-full" />
          </div>

          {/* Form */}
          <form onSubmit={handleStandardSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" /> Full Name of User
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Arjit Agrim"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" /> Email ID
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. arjitagrim1605@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Class / College / Institution
              </label>
              <input
                type="text"
                required
                placeholder="e.g. B.Tech Computer Science, 3rd Year / National Institute of Technology"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
              />
            </div>

            {/* Feature preview bullets */}
            <div className="pt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>AI Biodegradability Scanner</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Trash-to-Treasure Upcycling</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Voice Eco Assistant</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Google Sheets Sync Ready</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-900/40 transition duration-200 cursor-pointer"
            >
              <span>Enter Eco Tech AI Platform</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Secure Student & Campus Environmental Initiative</span>
          </div>
        </div>
      </div>
    </div>
  );
};
