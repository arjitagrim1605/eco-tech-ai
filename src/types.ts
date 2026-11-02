export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  college: string;
  loginAt: string;
  isGoogleLinked?: boolean;
  googlePhotoUrl?: string;
}

export interface EnvironmentalImpact {
  harmLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  microplasticRisk: string;
  carbonFootprint: string;
  oceanSoilThreat: string;
  summary: string;
}

export interface DisposalGuide {
  recommendedBin: string;
  binColor: 'blue' | 'green' | 'yellow' | 'black' | 'red';
  prepSteps: string[];
  recyclable: boolean;
  compostable: boolean;
  hazardous: boolean;
  specialInstructions: string;
}

export interface ObjectAnalysisResult {
  objectName: string;
  identificationConfidence?: 'high' | 'medium' | 'low';
  uncertaintyNotes?: string;
  category: string;
  isBiodegradable: boolean;
  biodegradabilityScore: number; // 0 to 100
  decompositionTime: string;
  environmentalImpact: EnvironmentalImpact;
  disposalGuide: DisposalGuide;
  ecoAlternatives: string[];
  voiceSummary: string;
  imageUrl?: string;
  analyzedAt?: string;
}

export interface UpcyclingProject {
  id: string;
  title: string;
  tagline: string;
  difficulty: 'Easy' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  utilityType: string;
  materialsNeeded: string[];
  tools: string[];
  steps: string[];
  sustainabilityBenefit: string;
  treasureScore: number;
  isBookmarked?: boolean;
}

export interface WasteToBestResult {
  detectedWaste: string;
  treasurePotential: string;
  divertedWasteWeight: string;
  projects: UpcyclingProject[];
  voiceSummary: string;
  imageUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface FeedbackItem {
  id: string;
  name: string;
  email: string;
  rating: number; // 1 to 5
  category: 'Tip' | 'Suggestion' | 'Idea' | 'Appreciation';
  comment: string;
  upvotes: number;
  timestamp: string;
}
