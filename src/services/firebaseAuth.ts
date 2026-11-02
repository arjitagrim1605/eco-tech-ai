import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Create Google provider with exact Sheets scope and explicit consent prompt
export const createGoogleProvider = (forceConsent = true, includeSheetsScope = true) => {
  const provider = new GoogleAuthProvider();
  if (includeSheetsScope) {
    // Only the spreadsheet owner needs this scope; ordinary users only sign in.
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  }
  if (forceConsent) {
    provider.setCustomParameters({
      prompt: 'consent select_account',
      access_type: 'offline',
    });
  }
  return provider;
};

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google (Popup) with forced consent parameter to ensure scope acquisition
export const googleSignIn = async (
  forceConsent = true,
  includeSheetsScope = true,
): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = createGoogleProvider(forceConsent, includeSheetsScope);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google sign in');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
