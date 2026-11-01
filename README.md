# Eco Tech AI - Environmental Intelligence & Upcycling Platform

An advanced environmental intelligence platform featuring:
- **AI Biodegradability Scanner**: Instant camera scanning of objects, material identification, degradation timeline, and eco-bin disposal guide.
- **Waste-to-Best Upcycling Engine**: Creative DIY blueprint generator to transform everyday trash into useful functional items.
- **Voice Eco Assistant**: Voice-enabled conversational AI advisor for zero-waste practices.
- **Community Feedback & Engagement**: Authentic community tips and reviews.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher)
- [Git](https://git-scm.com/)

### 2. Installation
```bash
# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env` file in the project root:
```env
PORT=3000
GEMINI_API_KEY="your-google-gemini-api-key"
```

### 4. Running Locally
```bash
# Start development server
npm run dev
```
Open your browser at `http://localhost:3000`.

### 5. Building for Production
```bash
npm run build
npm start
```

---

## 📦 How to Push to Your GitHub Repository

1. **Initialize Git repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Eco Tech AI"
   ```

2. **Connect to your GitHub repo:**
   ```bash
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git
   git push -u origin main
   ```

---

## 🌐 Deploying to Free Public Hosting (Zero Google Cloud Lock-in)

### Option A: Deploy to Render (Recommended for Full-Stack)
1. Go to [render.com](https://render.com) and sign in with GitHub.
2. Click **New +** > **Web Service**.
3. Select your GitHub repository.
4. Set:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run dev` (or `tsx server.ts`)
   - **Environment Variables:** Add `GEMINI_API_KEY`.
5. Click **Create Web Service**. Your app is live with a free public URL!

### Option B: Deploy to Railway
1. Go to [railway.app](https://railway.app).
2. Connect your GitHub repository.
3. Add `GEMINI_API_KEY` to variables.
4. Deploy instantly.
