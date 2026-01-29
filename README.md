# Red Cross AI Caller - Proof of Concept

A conversational AI system that simulates phone calls from Red Cross agents to donors, using OpenAI's Realtime API for natural German voice conversations.

## Features

- Natural German voice conversation with automatic turn-taking (VAD)
- User speaks first after answering the call
- iOS-style phone visualization during active calls
- Configurable prompts for different donor scenarios
- Clean, minimal UI optimized for quick POC testing

## Tech Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **AI:** OpenAI Realtime API (WebSocket)
- **Backend:** Vercel Serverless Functions
- **Storage:** Vercel KV (Redis)
- **Deployment:** Vercel

## Setup

### Prerequisites

- Node.js 18+
- OpenAI API key with Realtime API access
- Vercel account (for deployment)

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file:
   ```bash
   VITE_OPENAI_API_KEY=sk-proj-your-key-here
   ```

4. Add phone ring sound:
   - Download a phone ring MP3
   - Save as `public/sounds/phone-ring.mp3`

5. Start dev server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:5173

### Vercel Deployment

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Link project:
   ```bash
   vercel link
   ```

3. Add Vercel KV storage:
   - Go to Vercel dashboard
   - Add KV storage to your project
   - Environment variables will be auto-configured

4. Set environment variables:
   ```bash
   vercel env add VITE_OPENAI_API_KEY
   ```

5. Deploy:
   ```bash
   vercel --prod
   ```

## Usage

### Main Call Interface (`/`)

1. Click "Anruf starten" to begin
2. Click "Annehmen" when phone rings
3. Wait for connection, then speak first (e.g., "Hallo?")
4. Have natural conversation with AI agent
5. Click "Anruf beenden" to end call

### Configuration Page (`/config`)

Access directly via URL (no navigation link).

Configure:
- Agent name
- Donor name and details
- Current/target donation amounts
- Donation history
- Contact tone (Formal/Casual/Friendly)
- Additional instructions/tactics

Changes are saved to Vercel KV and apply to all users immediately.

## Project Structure

```
/
├── src/
│   ├── components/
│   │   ├── CallInterface.tsx      # Main call UI
│   │   ├── PhoneVisualization.tsx # Animated phone icon
│   │   └── RingingPhone.tsx       # Ring screen
│   ├── lib/
│   │   ├── openai-realtime.ts     # WebSocket manager
│   │   └── audio-processor.ts     # Audio capture/playback
│   ├── pages/
│   │   ├── Home.tsx               # Main page
│   │   └── Config.tsx             # Configuration form
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   └── App.tsx                    # Router setup
├── api/
│   └── config/
│       ├── get.ts                 # GET config endpoint
│       └── update.ts              # POST config endpoint
└── public/
    └── sounds/
        └── phone-ring.mp3         # Ring sound

## Architecture Notes

- **User speaks first:** Natural phone conversation flow
- **Server VAD:** OpenAI automatically detects turn-taking
- **German-only:** Hardcoded for authentic German responses
- **Shared config:** All users see same prompt settings (stored in KV)
- **No auth:** Protected via Vercel password protection

## Environment Variables

- `VITE_OPENAI_API_KEY` - Your OpenAI API key
- `KV_REST_API_URL` - Auto-set by Vercel
- `KV_REST_API_TOKEN` - Auto-set by Vercel
- `KV_REST_API_READ_ONLY_TOKEN` - Auto-set by Vercel

## License

POC - Internal Use Only
