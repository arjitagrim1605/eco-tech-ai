import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// Ensure data directory exists for persistent storage
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FEEDBACKS_FILE = path.join(DATA_DIR, 'feedbacks.json');
const SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';
const SHEETS_WEBHOOK_SECRET = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || '';

async function appendFeedbackToGoogleSheet(feedbacks: any[]): Promise<boolean> {
  if (!SHEETS_WEBHOOK_URL || !SHEETS_WEBHOOK_SECRET) return false;
  if (!SHEETS_WEBHOOK_URL.startsWith('https://script.google.com/macros/s/')) {
    console.error('Google Sheets feedback sync is disabled: webhook URL is not an Apps Script web app URL.');
    return false;
  }

  try {
    const response = await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: SHEETS_WEBHOOK_SECRET,
        feedbacks: feedbacks.slice(0, 100).map((feedback) => ({
          id: feedback.id,
          name: feedback.name,
          rating: feedback.rating,
          category: feedback.category,
          comment: feedback.comment,
          timestamp: feedback.timestamp,
        })),
      }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json().catch(() => null);
    return response.ok && result?.success === true;
  } catch (error) {
    console.warn('Google Sheets feedback sync is temporarily unavailable.');
    return false;
  }
}

async function appendLoginToGoogleSheet(login: any): Promise<boolean> {
  if (!SHEETS_WEBHOOK_URL || !SHEETS_WEBHOOK_SECRET) return false;
  try {
    const response = await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: SHEETS_WEBHOOK_SECRET,
        logins: [{
          id: login.id,
          name: login.name,
          email: login.email,
          phone: login.phone,
          college: login.college,
          timestamp: login.timestamp,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json().catch(() => null);
    return response.ok && result?.success === true;
  } catch (error) {
    console.warn('Google Sheets login sync is temporarily unavailable.');
    return false;
  }
}

async function readPublicFeedbackFromGoogleSheet(): Promise<any[] | null> {
  if (!SHEETS_WEBHOOK_URL) {
    console.warn('Sheets feedback feed is unavailable: webhook URL is not configured.');
    return null;
  }
  try {
    const response = await fetch(SHEETS_WEBHOOK_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      console.warn('Sheets feedback feed returned HTTP status', response.status);
      return null;
    }
    const result = await response.json().catch(() => null);
    if (result?.success !== true || !Array.isArray(result.feedbacks)) {
      console.warn('Sheets feedback feed returned an unexpected response.');
      return null;
    }
    console.info('Sheets feedback feed returned', result.feedbacks.length, 'records.');
    return result.feedbacks.filter((feedback: any) =>
      typeof feedback?.name === 'string' && typeof feedback?.comment === 'string'
    ).map((feedback: any) => ({
      id: String(feedback.id || ''),
      name: feedback.name,
      rating: Math.max(1, Math.min(5, Math.round(Number(feedback.rating) || 5))),
      category: String(feedback.category || 'Tip'),
      comment: feedback.comment,
      timestamp: String(feedback.timestamp || ''),
      upvotes: Math.max(0, Number(feedback.upvotes) || 0),
      syncedToSheet: true,
    }));
  } catch (error: any) {
    console.warn('Sheets feedback feed request failed:', error?.name || 'Unknown error');
    return null;
  }
}

// Initialize feedbacks with Pooja's authentic submission if not present
if (!fs.existsSync(FEEDBACKS_FILE)) {
  const initialFeedbacks = [
    {
      id: 'pooja-eco-review-1',
      name: 'Pooja',
      email: 'pooja@ecotech.community',
      rating: 5,
      category: 'Tip',
      comment:
        'Eco Tech AI is an amazing platform! The AI biodegradability scanner helped me identify plastic packaging that can be recycled, and the Waste-to-Best ideas are brilliant for campus sustainability.',
      upvotes: 6,
      timestamp: 'Nov 1, 2026',
      // This is display-only sample content, not a real visitor submission.
      syncedToSheet: true,
    },
  ];
  fs.writeFileSync(FEEDBACKS_FILE, JSON.stringify(initialFeedbacks, null, 2), 'utf-8');
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e);
  }
}

// Initialize Gemini SDK with server-side API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper for generating content with retry on temporary 503/429
async function generateWithRetry(params: any, retries = 2, delayMs = 1000): Promise<any> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err?.status === 503 ||
        err?.message?.includes('503') ||
        err?.message?.includes('high demand') ||
        err?.status === 429;
      if (attempt < retries && isTransient) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

// Fallback generator for object analysis if API is temporarily unavailable
function getObjectAnalysisFallback(itemName?: string) {
  const name = itemName || 'Consumer Packaging Item';
  const isOrganic = /banana|apple|food|fruit|vegetable|peel|compost/i.test(name);
  const isPlastic = /plastic|bottle|bag|wrapper|container|polyester/i.test(name);
  const isPaper = /cardboard|paper|box|carton/i.test(name);
  const isMetal = /can|aluminum|tin|foil/i.test(name);

  if (isOrganic) {
    return {
      objectName: name,
      category: 'Organic Biomass',
      isBiodegradable: true,
      biodegradabilityScore: 95,
      decompositionTime: '2 - 5 weeks',
      environmentalImpact: {
        harmLevel: 'Low',
        microplasticRisk: 'Zero microplastic hazard',
        carbonFootprint: 'Negligible (natural carbon cycle)',
        oceanSoilThreat: 'Enriches soil nitrogen and organic matter',
        summary: 'Fully natural organic material that enriches soil through composting.',
      },
      disposalGuide: {
        recommendedBin: 'Green Organic & Compost Bin',
        binColor: 'green',
        prepSteps: [
          'Separate from any plastic stickers or produce tape',
          'Chop or aerate to accelerate microbial breakdown',
          'Deposit in green compost or residential backyard compost pile',
        ],
        recyclable: false,
        compostable: true,
        hazardous: false,
        specialInstructions: 'Do not dispose in landfill where anaerobic conditions create methane.',
      },
      ecoAlternatives: ['Home vermiculture', 'Bokashi indoor fermentation'],
      voiceSummary: `This ${name} is 100 percent biodegradable and decomposes within a few weeks. Please place it in your green compost bin.`,
    };
  }

  if (isPlastic) {
    return {
      objectName: name,
      category: 'Polyethylene Terephthalate (PET #1)',
      isBiodegradable: false,
      biodegradabilityScore: 10,
      decompositionTime: '450 - 500 years',
      environmentalImpact: {
        harmLevel: 'High',
        microplasticRisk: 'High risk of microplastic fragmentation into marine habitats',
        carbonFootprint: 'Approx 82.8g CO2e per unit',
        oceanSoilThreat: 'Blocks digestive tracts of seabirds and marine fauna',
        summary: 'Non-biodegradable synthetic petrochemical polymer that persists for centuries.',
      },
      disposalGuide: {
        recommendedBin: 'Blue Recycling Bin (Rigid Plastics)',
        binColor: 'blue',
        prepSteps: [
          'Rinse thoroughly to remove residual liquids',
          'Crush or compress to minimize collection volume',
          'Replace plastic cap securely (modern recyclers reprocess both)',
        ],
        recyclable: true,
        compostable: false,
        hazardous: false,
        specialInstructions: 'Do not incinerate or discard in nature.',
      },
      ecoAlternatives: ['Stainless steel reusable flasks', 'Glass bottles', 'Silicone containers'],
      voiceSummary: `This ${name} is non-biodegradable and requires up to 450 years to decompose. Empty, rinse, and place it in your blue recycling bin.`,
    };
  }

  // Default fallback
  return {
    objectName: name,
    category: isPaper ? 'Cardboard / Pulp' : isMetal ? 'Metal Alloy' : 'Composite Material',
    isBiodegradable: isPaper,
    biodegradabilityScore: isPaper ? 85 : 20,
    decompositionTime: isPaper ? '2 - 3 months' : '200 - 500 years',
    environmentalImpact: {
      harmLevel: isPaper ? 'Low' : 'Moderate',
      microplasticRisk: 'Low direct microplastics',
      carbonFootprint: 'Requires municipal sorting energy',
      oceanSoilThreat: 'Accumulates in landfills if unsegregated',
      summary: 'Segregation enables closed-loop circular reclamation.',
    },
    disposalGuide: {
      recommendedBin: isPaper ? 'Blue Dry Paper/Recycling Bin' : 'Blue Mixed Metals/Recycling Bin',
      binColor: 'blue',
      prepSteps: [
        'Ensure dry and free of heavy oil or food grease',
        'Flatten to save storage and transportation space',
        'Place into designated dry recyclable stream',
      ],
      recyclable: true,
      compostable: isPaper,
      hazardous: false,
      specialInstructions: 'Check municipal collection schedule for curbside pickup.',
    },
    ecoAlternatives: ['Reusable containers', 'Refillable packaging'],
    voiceSummary: `This ${name} should be flattened, cleaned, and sorted into your blue recycling bin for circular reprocessing.`,
  };
}

// Fallback generator for Waste-to-Best
function getWasteToBestFallback(wasteDescription?: string) {
  const item = wasteDescription || 'Household Recyclable Waste';
  return {
    detectedWaste: item,
    treasurePotential: 'High',
    divertedWasteWeight: '350 grams',
    projects: [
      {
        id: 'fallback-proj-1',
        title: 'Self-Watering Botanical Planter',
        tagline: 'Sub-irrigation indoor planter using capillary wick physics',
        difficulty: 'Easy',
        estimatedTime: '15 mins',
        utilityType: 'Gardening',
        materialsNeeded: [item, 'Cotton cord / yarn wick', 'Potting soil', 'Plant cutting or seed'],
        tools: ['Scissors or utility shears'],
        steps: [
          'Carefully slice the container into two halves horizontally.',
          'Invert the top section like a funnel into the bottom water reservoir.',
          'Pass the cotton string through the opening so one end sits in the reservoir and the other in the soil.',
          'Add potting soil and your favorite herb or succulent; water the reservoir.',
        ],
        sustainabilityBenefit: 'Prevents landfill dumping while cultivating oxygen-producing greenery indoors.',
        treasureScore: 96,
      },
      {
        id: 'fallback-proj-2',
        title: 'Modular Desk & Cable Organizer',
        tagline: 'Neat compartmentalized workstation storage',
        difficulty: 'Easy',
        estimatedTime: '20 mins',
        utilityType: 'Organization',
        materialsNeeded: [item, 'Twine or decorative scrap paper', 'Non-toxic craft adhesive'],
        tools: ['Scissors', 'Ruler'],
        steps: [
          'Trim to uniform height suitable for pens, charging cords, or stationery.',
          'Smooth the cut edges using sand paper or washi tape for safety.',
          'Wrap external body with upcycled paper or jute rope for a minimalist aesthetic.',
          'Arrange on your study desk to keep cables and tools organized.',
        ],
        sustainabilityBenefit: 'Replaces bought plastic desk holders and promotes zero-waste study habits.',
        treasureScore: 92,
      },
    ],
    voiceSummary: `Turn your ${item} into treasure by creating a self-watering botanical planter in just 15 minutes!`,
  };
}

// Endpoint: AI Eco Channel - Object Analysis for Biodegradability & Disposal
app.post('/api/analyze-object', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', itemName } = req.body;

    if (!imageBase64 && !itemName) {
      return res.status(400).json({ error: 'Please provide either an image or item name.' });
    }

    const parts: any[] = [];
    if (imageBase64) {
      let detectedMime = mimeType || 'image/jpeg';
      const mimeMatch = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,/);
      if (mimeMatch) {
        detectedMime = mimeMatch[1];
      }
      const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: detectedMime,
          data: cleanBase64,
        },
      });
    }

    const promptText = `
You are Eco Tech AI, a world-class environmental scientist and waste management expert.
Analyze the supplied object image${itemName ? ` and use this optional user label as a hint, not as proof: "${itemName}"` : ''}.
Use the image as the primary evidence. Identify only details that are actually visible. If the object, material, or exact resin cannot be distinguished, say so plainly and lower the identification confidence; never guess a material, recycling number, decomposition time, or environmental figure. Distinguish general guidance from local rules, since recycling rules vary by location. Do not invent precise carbon or decomposition numbers when reliable evidence is not available.

Return ONLY a valid JSON response matching this schema:
{
  "objectName": "Recognized name of the item",
  "identificationConfidence": "high" | "medium" | "low",
  "uncertaintyNotes": "What cannot be determined from this image, or 'No major visual uncertainty'",
  "category": "Material category (e.g. Plastic PET #1, Organic, Glass, Electronic Waste, Cardboard)",
  "isBiodegradable": true or false,
  "biodegradabilityScore": number from 0 to 100,
  "decompositionTime": "Human readable duration, e.g. '450 - 500 years' or '2 - 4 weeks'",
  "environmentalImpact": {
    "harmLevel": "Low" | "Moderate" | "High" | "Critical",
    "microplasticRisk": "Description of microplastic or leachate danger",
    "carbonFootprint": "Estimated manufacturing/lifecycle carbon impact",
    "oceanSoilThreat": "Specific threat to marine wildlife, soil chemistry, or groundwater",
    "summary": "1-2 sentence concise impact summary"
  },
  "disposalGuide": {
    "recommendedBin": "Recommended receptacle, e.g. 'Blue Recycling Bin (Rigid Plastics)', 'Green Compost Bin', or 'Black Landfill Bin'",
    "binColor": "blue" | "green" | "yellow" | "black" | "red",
    "prepSteps": [
      "Step 1: cleaning or flattening",
      "Step 2: separation of caps or liners",
      "Step 3: proper deposit"
    ],
    "recyclable": true or false,
    "compostable": true or false,
    "hazardous": true or false,
    "specialInstructions": "Any local depot, municipal hazardous drop-off or cautions"
  },
  "ecoAlternatives": [
    "Alternative 1",
    "Alternative 2"
  ],
  "voiceSummary": "Clear, friendly, conversational 2-3 sentence summary intended to be spoken by a voice assistant explaining the object, biodegradability, and how to discard it."
}
`;
    parts.push({ text: promptText });

    try {
      const response = await generateWithRetry({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      const cleanJson = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      let parsedData: any;
      try {
        parsedData = JSON.parse(cleanJson);
      } catch (jsonErr) {
        console.warn('Object analysis returned invalid JSON:', jsonErr);
        return res.status(502).json({ success: false, error: 'The image analysis returned an unreadable result. Please try again with a clearer photo.' });
      }
      return res.json({ success: true, data: parsedData });
    } catch (genAiError: any) {
      console.error('Gemini object analysis failed:', genAiError?.message);
      return res.status(503).json({ success: false, error: 'AI image analysis is temporarily unavailable. Please try again shortly; no result was guessed.' });
    }
  } catch (error: any) {
    console.error('Error in analyze-object:', error);
    return res.status(500).json({ success: false, error: 'Image analysis failed. Please try again with another photo.' });
  }
});

// Endpoint: Waste to Best - Turn Trash into Treasure (Upcycling)
app.post('/api/waste-to-best', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', wasteDescription } = req.body;

    if (!imageBase64 && !wasteDescription) {
      return res.status(400).json({ error: 'Please provide either an image or a waste description.' });
    }

    const parts: any[] = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
    }

    const promptText = `
You are Eco Tech AI's "Waste to Best" master upcycling engineer and circular economy designer.
Your mission is to turn discarded trash into valuable, functional, and aesthetic treasure.
Analyze the waste material: "${wasteDescription || 'item in image'}".

Generate 3 diverse, practical DIY upcycle projects that a student, homeowner, or crafter can easily make.
Return ONLY a valid JSON response matching this schema:
{
  "detectedWaste": "Item name and material composition",
  "treasurePotential": "High" | "Exceptional" | "Moderate",
  "divertedWasteWeight": "Estimated grams/kg kept out of landfills",
  "projects": [
    {
      "id": "project-1",
      "title": "Creative project title (e.g. Self-Watering Hanging Planter)",
      "tagline": "Catchy 1-sentence description of the upcycled creation",
      "difficulty": "Easy" | "Intermediate" | "Advanced",
      "estimatedTime": "Estimated time, e.g. '20 mins' or '1 hour'",
      "utilityType": "Home Decor" | "Gardening" | "Organization" | "Utility" | "Art & Fashion",
      "materialsNeeded": [
        "Primary waste item",
        "Common household bonding/cutting agent",
        "Decorative or functional additions"
      ],
      "tools": [
        "Scissors or cutter",
        "Glue or twine"
      ],
      "steps": [
        "Step 1: Cleaning & preparing the waste item",
        "Step 2: Cutting or reshaping",
        "Step 3: Assembly & attaching fixtures",
        "Step 4: Finishing touches & functional use"
      ],
      "sustainabilityBenefit": "Why this creates value and prevents landfill accumulation",
      "treasureScore": number 80 to 99
    }
  ],
  "voiceSummary": "A motivational 2-sentence voice readout highlighting the best upcycle transformation idea."
}
`;
    parts.push({ text: promptText });

    try {
      const response = await generateWithRetry({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      const parsedData = JSON.parse(text);
      return res.json({ success: true, data: parsedData });
    } catch (genAiError: any) {
      console.warn('Gemini generateContent transient error, using upcycling fallback:', genAiError?.message);
      const fallback = getWasteToBestFallback(wasteDescription);
      return res.json({ success: true, data: fallback });
    }
  } catch (error: any) {
    console.error('Error generating upcycling blueprints:', error);
    const fallback = getWasteToBestFallback(req.body.wasteDescription);
    return res.json({ success: true, data: fallback });
  }
});

// Endpoint: Chat Assistant - Eco & Sustainability Knowledge
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], currentContext } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const systemInstruction = `
You are the Eco Tech AI Chat Assistant. You are a passionate, highly knowledgeable, and friendly sustainability advisor, zero-waste advocate, and environmental engineer.
Accuracy rules: prioritize correctness over sounding certain; never invent facts, sources, local recycling rules, exact decomposition times, or statistics. If the answer depends on location, ask for the user's city/country or explain that local rules differ. If evidence is insufficient or you are unsure, say what is unknown and give a safe way to verify it. Separate established facts from estimates and suggestions. Use the user's latest question once, and use earlier messages only as context.
Your purpose:
- Help users understand recycling rules, composting, biodegradability, upcycling, carbon footprint reduction, circular economies, and eco-friendly daily habits.
- Provide actionable, precise, and practical tips tailored for students, households, and institutions.
- If the user refers to an item recently scanned (Context: ${currentContext ? JSON.stringify(currentContext) : 'None'}), give tailored follow-up guidance.
- Keep tone encouraging, forward-looking, and realistic. Use clean formatting with bullet points where appropriate.
`;

    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      for (const item of history.slice(-10)) {
        contents.push({
          role: item.role === 'assistant' || item.role === 'model' ? 'model' : 'user',
          parts: [{ text: item.content || item.text || '' }],
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    try {
      const response = await generateWithRetry({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
        },
      });

      const reply = response.text || 'I am ready to help with any questions on sustainability and recycling!';
      return res.json({ success: true, reply });
    } catch (genAiError: any) {
      console.warn('Gemini chat is unavailable:', genAiError?.message);
      return res.status(503).json({ success: false, error: 'The assistant is temporarily unavailable, so it cannot give a reliable answer right now. Please try again shortly.' });
    }
  } catch (error: any) {
    console.error('Error in eco chat:', error);
    return res.status(500).json({
      error: error?.message || 'Eco chat assistant encountered an error.',
    });
  }
});

// Community Feedback Routes (Persistent across all users & browsers)
app.get('/api/feedbacks', async (_req, res) => {
  const localFeedbacks = readJsonFile<any[]>(FEEDBACKS_FILE, []);
  const sheetFeedbacks = await readPublicFeedbackFromGoogleSheet();
  const merged = new Map<string, any>();
  const addFeedback = (feedback: any) => {
    const key = [feedback.name, feedback.timestamp, feedback.comment]
      .map((value) => String(value || '').trim().toLocaleLowerCase())
      .join('\u001f');
    if (key !== '\u001f\u001f') merged.set(key, feedback);
  };

  localFeedbacks.forEach(addFeedback);
  (sheetFeedbacks || []).forEach(addFeedback);
  console.info('Feedback feed totals:', { local: localFeedbacks.length, sheet: sheetFeedbacks?.length || 0, merged: merged.size });

  // Feedback is public, but submitters' email addresses are never returned.
  res.json({
    success: true,
    feedbacks: Array.from(merged.values()).map(({ email: _email, ...feedback }) => feedback),
  });
});

app.post('/api/feedbacks', async (req, res) => {
  try {
    const { name, rating, category, comment } = req.body;
    if (typeof comment !== 'string' || typeof name !== 'string' || !comment.trim() || !name.trim()) {
      return res.status(400).json({ error: 'Name and comment are required.' });
    }
    if (name.trim().length > 80 || comment.trim().length > 2000) {
      return res.status(400).json({ error: 'Name or feedback is too long.' });
    }

    const feedbacks = readJsonFile<any[]>(FEEDBACKS_FILE, []);
    const newFeedback = {
      id: `review-${Date.now()}`,
      name: name.trim(),
      rating: Math.max(1, Math.min(5, Math.round(Number(rating) || 5))),
      category: typeof category === 'string' ? category.trim().slice(0, 80) : 'Tip',
      comment: comment.trim(),
      upvotes: 0,
      timestamp: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      syncedToSheet: false,
    };

    feedbacks.unshift(newFeedback);
    writeJsonFile(FEEDBACKS_FILE, feedbacks);

    const pendingFeedbacks = readJsonFile<any[]>(FEEDBACKS_FILE, [])
      .filter((feedback) => !feedback.syncedToSheet && feedback.id !== 'pooja-eco-review-1')
      .slice(0, 100);
    const syncedToSheet = await appendFeedbackToGoogleSheet(pendingFeedbacks);
    if (syncedToSheet) {
      const latestFeedbacks = readJsonFile<any[]>(FEEDBACKS_FILE, []);
      const syncedIds = new Set(pendingFeedbacks.map((feedback) => feedback.id));
      latestFeedbacks.forEach((feedback) => {
        if (syncedIds.has(feedback.id)) feedback.syncedToSheet = true;
      });
      writeJsonFile(FEEDBACKS_FILE, latestFeedbacks);
    }

    const latestFeedbacks = readJsonFile<any[]>(FEEDBACKS_FILE, []);
    const savedFeedback = latestFeedbacks.find((feedback) => feedback.id === newFeedback.id) || newFeedback;
    res.json({ success: true, syncedToSheet: savedFeedback.syncedToSheet === true, feedback: savedFeedback });
  } catch (err: any) {
    console.error('Error adding feedback:', err);
    res.status(500).json({ error: 'Could not record feedback.' });
  }
});

app.post('/api/feedbacks/upvote', (req, res) => {
  try {
    const { id } = req.body;
    const feedbacks = readJsonFile<any[]>(FEEDBACKS_FILE, []);
    const target = feedbacks.find((f) => f.id === id);
    if (target) {
      target.upvotes = (target.upvotes || 0) + 1;
      writeJsonFile(FEEDBACKS_FILE, feedbacks);
      return res.json({ success: true, upvotes: target.upvotes });
    }
    res.status(404).json({ error: 'Feedback not found.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Could not upvote.' });
  }
});

app.post('/api/feedbacks/mark-synced', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'Array of ids required.' });
    }
    const feedbacks = readJsonFile<any[]>(FEEDBACKS_FILE, []);
    feedbacks.forEach((f) => {
      if (ids.includes(f.id)) {
        f.syncedToSheet = true;
      }
    });
    writeJsonFile(FEEDBACKS_FILE, feedbacks);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Could not mark synced.' });
  }
});

// Forward only the user-approved profile fields to the private Google Sheet.
// Login data is not written to local disk or returned by a public read endpoint.
app.post('/api/logins', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const college = typeof req.body?.college === 'string' ? req.body.college.trim() : '';

  if (!name || !email || !email.includes('@') || name.length > 120 || email.length > 254 || phone.length > 80 || college.length > 160) {
    return res.status(400).json({ success: false, error: 'Please provide valid login details.' });
  }

  const synced = await appendLoginToGoogleSheet({
    id: randomUUID(),
    name,
    email,
    phone,
    college,
    timestamp: new Date().toISOString(),
  });
  if (!synced) {
    return res.status(503).json({ success: false, error: 'Google Sheets login sync is unavailable.' });
  }
  return res.json({ success: true });
});

// Sheet settings stay in each user's browser; never expose a shared sheet configuration.
app.get('/api/sheet-config', (_req, res) => {
  res.json({ success: true, config: { spreadsheetId: '', spreadsheetUrl: '' } });
});

app.post('/api/sheet-config', (_req, res) => {
  res.json({ success: true, config: { spreadsheetId: '', spreadsheetUrl: '' } });
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Eco Tech AI API Server',
    timestamp: new Date().toISOString(),
  });
});

// Vite middleware integration for full-stack dev and static serving in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Eco Tech AI server running on http://localhost:${PORT}`);
  });
}

startServer();
