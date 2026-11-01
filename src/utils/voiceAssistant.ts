/**
 * Voice Assistant Utility
 * Supports Speech-to-Text (Recognition) and Text-to-Speech (Synthesis)
 */

class VoiceAssistant {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private recognition: any = null;
  private isListeningActive = false;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
      }
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
      }
    }
  }

  public isVoiceSupported(): boolean {
    return !!this.synth;
  }

  public isSpeechRecSupported(): boolean {
    return !!this.recognition;
  }

  public speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ) {
    if (!this.synth) return;

    this.stop(); // Stop any active speech

    // Remove markdown formatting, asterisks, hashtags for smoother audio reading
    const cleanText = text
      .replace(/[*#_`>]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utterance;

    const voices = this.synth.getVoices();
    // Prefer pleasant natural English voices
    const preferredVoice = voices.find(
      (v) =>
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Karen')) &&
        v.lang.startsWith('en')
    ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      onError?.(e);
      onEnd?.();
    };

    this.synth.speak(utterance);
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    return !!(this.synth && (this.synth.speaking || this.synth.pending));
  }

  public startListening(
    onResult: (transcript: string) => void,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ) {
    if (!this.recognition) {
      onError?.(new Error('Speech recognition is not supported in this browser.'));
      return;
    }

    try {
      this.isListeningActive = true;
      this.recognition.onstart = () => {
        onStart?.();
      };
      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };
      this.recognition.onerror = (e: any) => {
        this.isListeningActive = false;
        onError?.(e);
        onEnd?.();
      };
      this.recognition.onend = () => {
        this.isListeningActive = false;
        onEnd?.();
      };

      this.recognition.start();
    } catch (e) {
      this.isListeningActive = false;
      onError?.(e);
    }
  }

  public stopListening() {
    if (this.recognition && this.isListeningActive) {
      this.recognition.stop();
      this.isListeningActive = false;
    }
  }
}

export const voiceAssistant = new VoiceAssistant();
