# Red Cross AI Caller - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a POC web app for a German-speaking AI phone agent that attempts to upsell Red Cross donors through natural conversation using OpenAI's Realtime API.

**Architecture:** Vite + React + TypeScript frontend with Tailwind CSS, OpenAI Realtime API via WebSocket for bidirectional voice, Vercel Serverless Functions for config API, and Vercel KV for shared prompt storage. User speaks first after answering, VAD handles turn detection, iOS-style phone visualization during conversation.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, OpenAI Realtime API, Web Audio API, Vercel Functions, Vercel KV

---

## Task 1: Project Foundation & Dependencies

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `.env.local.example`
- Create: `.gitignore`
- Create: `index.html`

**Step 1: Initialize Vite project**

Run: `npm create vite@latest . -- --template react-ts`
Expected: Project scaffolded with React + TypeScript

**Step 2: Install dependencies**

Run:
```bash
npm install @vercel/kv
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Expected: Dependencies installed successfully

**Step 3: Configure Tailwind CSS**

In `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'redcross': '#ED1B2E',
      }
    },
  },
  plugins: [],
}
```

**Step 4: Create global CSS with Tailwind directives**

Create `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Step 5: Create environment variable example**

Create `.env.local.example`:
```bash
# OpenAI API Key
VITE_OPENAI_API_KEY=sk-proj-...

# Vercel KV (auto-provided in Vercel, use local Redis or dev env for local testing)
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
```

**Step 6: Update .gitignore**

Ensure `.gitignore` includes:
```
.env.local
.env
node_modules
dist
.vercel
```

**Step 7: Verify dev server runs**

Run: `npm run dev`
Expected: Dev server starts on http://localhost:5173

**Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Vite + React + TypeScript project with Tailwind CSS"
```

---

## Task 2: Type Definitions & Shared Interfaces

**Files:**
- Create: `src/types/index.ts`

**Step 1: Define CallState enum and PromptConfig interface**

Create `src/types/index.ts`:
```typescript
export enum CallState {
  IDLE = 'IDLE',
  RINGING = 'RINGING',
  CONNECTING = 'CONNECTING',
  USER_SPEAKING = 'USER_SPEAKING',
  AGENT_SPEAKING = 'AGENT_SPEAKING',
  CONVERSATION = 'CONVERSATION',
  ENDED = 'ENDED',
}

export type ContactTone = 'Formal' | 'Casual' | 'Friendly';

export interface PromptConfig {
  agentName: string;
  donorName: string;
  currentAmount: number;
  targetAmount: number;
  donationHistory: string;
  contactTone: ContactTone;
  additionalInstructions?: string;
}

export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  agentName: 'Sarah',
  donorName: 'Max Mustermann',
  currentAmount: 20,
  targetAmount: 35,
  donationHistory: '2 Jahre',
  contactTone: 'Friendly',
  additionalInstructions: '',
};
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions for call states and config"
```

---

## Task 3: Vercel KV Configuration API - GET Endpoint

**Files:**
- Create: `api/config/get.ts`

**Step 1: Create GET endpoint for configuration**

Create `api/config/get.ts`:
```typescript
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_CONFIG = {
  agentName: 'Sarah',
  donorName: 'Max Mustermann',
  currentAmount: 20,
  targetAmount: 35,
  donationHistory: '2 Jahre',
  contactTone: 'Friendly',
  additionalInstructions: '',
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = await kv.get('red-cross-caller:prompt-config');

    if (!config) {
      return res.status(200).json(DEFAULT_CONFIG);
    }

    return res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    return res.status(500).json({ error: 'Failed to fetch configuration' });
  }
}
```

**Step 2: Commit**

```bash
git add api/config/get.ts
git commit -m "feat: add GET /api/config endpoint for fetching prompt configuration"
```

---

## Task 4: Vercel KV Configuration API - POST Endpoint

**Files:**
- Create: `api/config/update.ts`

**Step 1: Create POST endpoint for updating configuration**

Create `api/config/update.ts`:
```typescript
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface PromptConfig {
  agentName: string;
  donorName: string;
  currentAmount: number;
  targetAmount: number;
  donationHistory: string;
  contactTone: 'Formal' | 'Casual' | 'Friendly';
  additionalInstructions?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config: PromptConfig = req.body;

    // Validation
    if (!config.agentName || !config.donorName) {
      return res.status(400).json({ error: 'Agent name and donor name are required' });
    }

    if (config.currentAmount <= 0) {
      return res.status(400).json({ error: 'Current amount must be greater than 0' });
    }

    if (config.targetAmount <= config.currentAmount) {
      return res.status(400).json({ error: 'Target amount must be greater than current amount' });
    }

    if (!['Formal', 'Casual', 'Friendly'].includes(config.contactTone)) {
      return res.status(400).json({ error: 'Invalid contact tone' });
    }

    await kv.set('red-cross-caller:prompt-config', config);

    return res.status(200).json({ success: true, config });
  } catch (error) {
    console.error('Error updating config:', error);
    return res.status(500).json({ error: 'Failed to update configuration' });
  }
}
```

**Step 2: Commit**

```bash
git add api/config/update.ts
git commit -m "feat: add POST /api/config endpoint for updating prompt configuration"
```

---

## Task 5: Configuration Page Component

**Files:**
- Create: `src/pages/Config.tsx`

**Step 1: Create configuration form page**

Create `src/pages/Config.tsx`:
```typescript
import React, { useState, useEffect } from 'react';
import type { PromptConfig, ContactTone } from '../types';

export default function Config() {
  const [config, setConfig] = useState<PromptConfig>({
    agentName: '',
    donorName: '',
    currentAmount: 0,
    targetAmount: 0,
    donationHistory: '',
    contactTone: 'Friendly',
    additionalInstructions: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config/get');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
      setMessage('Fehler beim Laden der Konfiguration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/config/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Konfiguration erfolgreich gespeichert ✓');
      } else {
        setMessage(`Fehler: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage('Fehler beim Speichern der Konfiguration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Anruf-Konfiguration
        </h1>

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-6">
          {/* Agent Settings */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent-Einstellungen</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="agentName" className="block text-sm font-medium text-gray-700">
                  Agent Name *
                </label>
                <input
                  type="text"
                  id="agentName"
                  required
                  value={config.agentName}
                  onChange={(e) => setConfig({ ...config, agentName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                />
              </div>

              <div>
                <label htmlFor="contactTone" className="block text-sm font-medium text-gray-700">
                  Kontaktton *
                </label>
                <select
                  id="contactTone"
                  required
                  value={config.contactTone}
                  onChange={(e) => setConfig({ ...config, contactTone: e.target.value as ContactTone })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                >
                  <option value="Formal">Formal</option>
                  <option value="Casual">Casual</option>
                  <option value="Friendly">Friendly</option>
                </select>
              </div>
            </div>
          </div>

          {/* Donor Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Spender-Informationen</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="donorName" className="block text-sm font-medium text-gray-700">
                  Spender Name *
                </label>
                <input
                  type="text"
                  id="donorName"
                  required
                  value={config.donorName}
                  onChange={(e) => setConfig({ ...config, donorName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="currentAmount" className="block text-sm font-medium text-gray-700">
                    Aktueller Betrag (€) *
                  </label>
                  <input
                    type="number"
                    id="currentAmount"
                    required
                    min="1"
                    value={config.currentAmount}
                    onChange={(e) => setConfig({ ...config, currentAmount: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                  />
                </div>

                <div>
                  <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700">
                    Ziel-Betrag (€) *
                  </label>
                  <input
                    type="number"
                    id="targetAmount"
                    required
                    min={config.currentAmount + 1}
                    value={config.targetAmount}
                    onChange={(e) => setConfig({ ...config, targetAmount: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="donationHistory" className="block text-sm font-medium text-gray-700">
                  Spendenhistorie *
                </label>
                <input
                  type="text"
                  id="donationHistory"
                  required
                  placeholder="z.B. 2 Jahre"
                  value={config.donationHistory}
                  onChange={(e) => setConfig({ ...config, donationHistory: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                />
              </div>
            </div>
          </div>

          {/* Additional Instructions */}
          <div>
            <label htmlFor="additionalInstructions" className="block text-sm font-medium text-gray-700">
              Zusätzliche Anweisungen
            </label>
            <textarea
              id="additionalInstructions"
              rows={4}
              value={config.additionalInstructions}
              onChange={(e) => setConfig({ ...config, additionalInstructions: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
              placeholder="Spezielle Taktiken oder Hinweise für den Agent..."
            />
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-redcross text-white py-3 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-redcross focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Speichert...' : 'Konfiguration speichern'}
            </button>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`p-4 rounded-md ${message.includes('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/Config.tsx
git commit -m "feat: add configuration page with form for prompt settings"
```

---

## Task 6: OpenAI Realtime WebSocket Handler

**Files:**
- Create: `src/lib/openai-realtime.ts`

**Step 1: Create WebSocket connection manager**

Create `src/lib/openai-realtime.ts`:
```typescript
import type { PromptConfig } from '../types';

export interface RealtimeConnectionConfig {
  apiKey: string;
  promptConfig: PromptConfig;
  onAudioDelta: (audioData: string) => void;
  onAgentSpeaking: () => void;
  onAgentFinished: () => void;
  onUserTranscript?: (text: string) => void;
  onError: (error: string) => void;
  onConnectionEstablished: () => void;
}

export class OpenAIRealtimeConnection {
  private ws: WebSocket | null = null;
  private config: RealtimeConnectionConfig;

  constructor(config: RealtimeConnectionConfig) {
    this.config = config;
  }

  connect(): void {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

    this.ws = new WebSocket(url, [
      'realtime',
      `openai-insecure-api-key.${this.config.apiKey}`,
      'openai-beta.realtime-v1'
    ]);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.sendSessionUpdate();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.config.onError('Verbindung unterbrochen');
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
    };
  }

  private sendSessionUpdate(): void {
    const { promptConfig } = this.config;

    const systemPrompt = `Du bist ${promptConfig.agentName}, und du rufst ${promptConfig.donorName} vom Deutschen Roten Kreuz an.

Spender-Informationen:
- Aktueller monatlicher Spendenbetrag: €${promptConfig.currentAmount}
- Ziel-Spendenbetrag: €${promptConfig.targetAmount}
- Spendenhistorie: ${promptConfig.donationHistory}
- Kontaktton: ${promptConfig.contactTone}

${promptConfig.additionalInstructions ? `Zusätzliche Anweisungen:\n${promptConfig.additionalInstructions}\n` : ''}

WICHTIG: Sprich natürlich und authentisch auf Deutsch.
Dein Ziel ist es, ${promptConfig.donorName} durch psychologische Gesprächsführung dazu zu bewegen, die monatliche Spende auf €${promptConfig.targetAmount} zu erhöhen.

KRITISCH: Du MUSST zu jeder Zeit auf Deutsch sprechen. Alle Antworten müssen in fließendem, natürlichem Deutsch sein.

Der Spender spricht zuerst (z.B. "Hallo?"). Warte auf seine Begrüßung und antworte dann professionell.`;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        instructions: systemPrompt,
      },
    };

    this.send(sessionUpdate);
    this.config.onConnectionEstablished();
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'session.created':
        console.log('Session created:', message);
        break;

      case 'response.audio.delta':
        this.config.onAudioDelta(message.delta);
        this.config.onAgentSpeaking();
        break;

      case 'response.audio.done':
        this.config.onAgentFinished();
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (this.config.onUserTranscript) {
          this.config.onUserTranscript(message.transcript);
        }
        break;

      case 'error':
        console.error('OpenAI error:', message);
        this.config.onError(message.error?.message || 'Ein Fehler ist aufgetreten');
        break;

      default:
        // Log other events for debugging
        console.log('Received event:', message.type);
    }
  }

  sendAudio(audioData: string): void {
    this.send({
      type: 'input_audio_buffer.append',
      audio: audioData,
    });
  }

  commitAudio(): void {
    this.send({
      type: 'input_audio_buffer.commit',
    });
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/openai-realtime.ts
git commit -m "feat: add OpenAI Realtime API WebSocket connection manager"
```

---

## Task 7: Audio Processing Utilities

**Files:**
- Create: `src/lib/audio-processor.ts`

**Step 1: Create audio capture and playback utilities**

Create `src/lib/audio-processor.ts`:
```typescript
export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioQueue: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;

  async requestMicrophoneAccess(): Promise<MediaStream> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      return this.mediaStream;
    } catch (error) {
      throw new Error('Mikrofonzugriff verweigert');
    }
  }

  startCapture(onAudioData: (base64Audio: string) => void): void {
    if (!this.mediaStream) {
      throw new Error('Microphone access not granted');
    }

    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcm16 = this.floatTo16BitPCM(inputData);
      const base64 = this.arrayBufferToBase64(pcm16);
      onAudioData(base64);
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  stopCapture(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  async playAudioDelta(base64Audio: string): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = this.audioContext.currentTime;
    }

    const audioData = this.base64ToArrayBuffer(base64Audio);
    const int16Array = new Int16Array(audioData);
    const float32Array = new Float32Array(int16Array.length);

    // Convert PCM16 to Float32
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.copyToChannel(float32Array, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;

    this.audioQueue.push(source);
  }

  stopPlayback(): void {
    this.audioQueue.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.audioQueue = [];
    this.nextStartTime = 0;
  }

  private floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  cleanup(): void {
    this.stopCapture();
    this.stopPlayback();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/audio-processor.ts
git commit -m "feat: add audio processing utilities for capture and playback"
```

---

## Task 8: Phone Visualization Component

**Files:**
- Create: `src/components/PhoneVisualization.tsx`

**Step 1: Create animated phone visualization**

Create `src/components/PhoneVisualization.tsx`:
```typescript
import React from 'react';

interface PhoneVisualizationProps {
  isSpeaking: boolean;
}

export default function PhoneVisualization({ isSpeaking }: PhoneVisualizationProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      {/* Animated Circles */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        {isSpeaking && (
          <>
            <div className="absolute w-48 h-48 rounded-full bg-redcross opacity-20 animate-ping" />
            <div className="absolute w-40 h-40 rounded-full bg-redcross opacity-30 animate-pulse" />
            <div className="absolute w-32 h-32 rounded-full bg-redcross opacity-40 animate-ping animation-delay-300" />
          </>
        )}

        {/* Center Circle */}
        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
          isSpeaking ? 'bg-redcross scale-110' : 'bg-redcross/60 scale-100'
        }`}>
          <svg
            className="w-12 h-12 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center">
        <p className={`text-lg font-medium transition-colors duration-300 ${
          isSpeaking ? 'text-redcross' : 'text-gray-600'
        }`}>
          {isSpeaking ? 'Agent spricht...' : 'Zuhören...'}
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Add animation delay utility to Tailwind config**

Update `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'redcross': '#ED1B2E',
      },
      animation: {
        'ping': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        ping: {
          '75%, 100%': {
            transform: 'scale(1.5)',
            opacity: '0',
          },
        },
        pulse: {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '.5',
          },
        },
      },
    },
  },
  plugins: [],
}
```

**Step 3: Commit**

```bash
git add src/components/PhoneVisualization.tsx tailwind.config.js
git commit -m "feat: add phone visualization component with pulsing animations"
```

---

## Task 9: Ringing Phone Component

**Files:**
- Create: `src/components/RingingPhone.tsx`

**Step 1: Create ringing animation component**

Create `src/components/RingingPhone.tsx`:
```typescript
import React, { useEffect, useRef } from 'react';

interface RingingPhoneProps {
  onAnswer: () => void;
  onDecline: () => void;
}

export default function RingingPhone({ onAnswer, onDecline }: RingingPhoneProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for ringing sound
    audioRef.current = new Audio('/sounds/phone-ring.mp3');
    audioRef.current.loop = true;
    audioRef.current.play().catch(err => {
      console.warn('Could not play ring sound:', err);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleAnswer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onAnswer();
  };

  const handleDecline = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onDecline();
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      {/* Phone Icon with Pulsing Animation */}
      <div className="relative">
        <div className="absolute inset-0 w-32 h-32 bg-green-400 rounded-full animate-ping opacity-75" />
        <div className="relative w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
          <svg
            className="w-16 h-16 text-white animate-bounce"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Eingehender Anruf</h2>
        <p className="text-gray-600">Deutsches Rotes Kreuz</p>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={handleDecline}
          className="px-8 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
        >
          Ablehnen
        </button>
        <button
          onClick={handleAnswer}
          className="px-8 py-3 bg-green-500 text-white rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
        >
          Annehmen
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/RingingPhone.tsx
git commit -m "feat: add ringing phone component with answer/decline actions"
```

---

## Task 10: Main Call Interface Component

**Files:**
- Create: `src/components/CallInterface.tsx`

**Step 1: Create main call interface with state management**

Create `src/components/CallInterface.tsx`:
```typescript
import React, { useState, useRef, useEffect } from 'react';
import { CallState, type PromptConfig } from '../types';
import { OpenAIRealtimeConnection } from '../lib/openai-realtime';
import { AudioProcessor } from '../lib/audio-processor';
import PhoneVisualization from './PhoneVisualization';
import RingingPhone from './RingingPhone';

export default function CallInterface() {
  const [callState, setCallState] = useState<CallState>(CallState.IDLE);
  const [error, setError] = useState<string>('');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  const connectionRef = useRef<OpenAIRealtimeConnection | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }
    if (audioProcessorRef.current) {
      audioProcessorRef.current.cleanup();
      audioProcessorRef.current = null;
    }
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
  };

  const startCall = () => {
    setCallState(CallState.RINGING);
    setError('');
  };

  const answerCall = async () => {
    setCallState(CallState.CONNECTING);

    try {
      // Fetch configuration
      const configResponse = await fetch('/api/config/get');
      const promptConfig: PromptConfig = await configResponse.json();

      // Initialize audio processor
      audioProcessorRef.current = new AudioProcessor();
      await audioProcessorRef.current.requestMicrophoneAccess();

      // Get API key from environment
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Initialize WebSocket connection
      connectionRef.current = new OpenAIRealtimeConnection({
        apiKey,
        promptConfig,
        onAudioDelta: (audioData) => {
          audioProcessorRef.current?.playAudioDelta(audioData);
        },
        onAgentSpeaking: () => {
          setIsAgentSpeaking(true);
          setCallState(CallState.AGENT_SPEAKING);

          // Clear existing timeout
          if (speakingTimeoutRef.current) {
            clearTimeout(speakingTimeoutRef.current);
          }

          // Set timeout to return to conversation state
          speakingTimeoutRef.current = setTimeout(() => {
            setIsAgentSpeaking(false);
            setCallState(CallState.CONVERSATION);
          }, 500);
        },
        onAgentFinished: () => {
          setIsAgentSpeaking(false);
          setCallState(CallState.CONVERSATION);
        },
        onError: (errorMessage) => {
          setError(errorMessage);
          endCall();
        },
        onConnectionEstablished: () => {
          setCallState(CallState.USER_SPEAKING);

          // Start capturing audio
          audioProcessorRef.current?.startCapture((audioData) => {
            connectionRef.current?.sendAudio(audioData);
          });
        },
      });

      connectionRef.current.connect();
    } catch (err) {
      console.error('Error starting call:', err);
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen');
      setCallState(CallState.IDLE);
    }
  };

  const declineCall = () => {
    setCallState(CallState.IDLE);
  };

  const endCall = () => {
    cleanup();
    setCallState(CallState.ENDED);

    // Return to IDLE after brief delay
    setTimeout(() => {
      setCallState(CallState.IDLE);
      setError('');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-center">{error}</p>
            <button
              onClick={() => setError('')}
              className="mt-2 w-full text-red-600 hover:text-red-800 text-sm"
            >
              Schließen
            </button>
          </div>
        )}

        {/* IDLE State */}
        {callState === CallState.IDLE && (
          <div className="text-center space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                DRK Anrufsimulator
              </h1>
              <p className="text-gray-600">
                Starten Sie einen simulierten Anruf
              </p>
            </div>

            <button
              onClick={startCall}
              className="w-full max-w-xs mx-auto block bg-redcross text-white py-4 px-8 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-redcross focus:ring-offset-2 transition-colors text-lg font-semibold shadow-lg"
            >
              Anruf starten
            </button>
          </div>
        )}

        {/* RINGING State */}
        {callState === CallState.RINGING && (
          <RingingPhone onAnswer={answerCall} onDecline={declineCall} />
        )}

        {/* CONNECTING State */}
        {callState === CallState.CONNECTING && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-redcross mb-4" />
            <p className="text-gray-600">Verbinden...</p>
          </div>
        )}

        {/* ACTIVE CALL States (USER_SPEAKING, AGENT_SPEAKING, CONVERSATION) */}
        {(callState === CallState.USER_SPEAKING ||
          callState === CallState.AGENT_SPEAKING ||
          callState === CallState.CONVERSATION) && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-xl font-semibold text-center text-gray-900 mb-6">
                Anruf läuft
              </h2>

              <PhoneVisualization isSpeaking={isAgentSpeaking} />
            </div>

            <button
              onClick={endCall}
              className="w-full bg-redcross text-white py-4 px-8 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-redcross focus:ring-offset-2 transition-colors font-semibold shadow-lg"
            >
              Anruf beenden
            </button>
          </div>
        )}

        {/* ENDED State */}
        {callState === CallState.ENDED && (
          <div className="text-center space-y-4">
            <div className="text-6xl">📞</div>
            <h2 className="text-2xl font-bold text-gray-900">Anruf beendet</h2>
            <p className="text-gray-600">Kehre zum Startbildschirm zurück...</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/CallInterface.tsx
git commit -m "feat: add main call interface with WebSocket and audio integration"
```

---

## Task 11: Main App Component with Routing

**Files:**
- Create: `src/App.tsx`
- Modify: `src/main.tsx`

**Step 1: Create App with routing**

Create `src/App.tsx`:
```typescript
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Config from './pages/Config';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/config" element={<Config />} />
      </Routes>
    </Router>
  );
}

export default App;
```

**Step 2: Create Home page**

Create `src/pages/Home.tsx`:
```typescript
import React from 'react';
import CallInterface from '../components/CallInterface';

export default function Home() {
  return <CallInterface />;
}
```

**Step 3: Install React Router**

Run: `npm install react-router-dom`

**Step 4: Update main.tsx**

Modify `src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 5: Commit**

```bash
git add src/App.tsx src/pages/Home.tsx src/main.tsx package.json package-lock.json
git commit -m "feat: add routing with React Router for home and config pages"
```

---

## Task 12: Add Phone Ring Sound Asset

**Files:**
- Create: `public/sounds/phone-ring.mp3`

**Step 1: Create sounds directory**

Run: `mkdir -p public/sounds`

**Step 2: Add placeholder or download ring sound**

You'll need to add an actual phone ring MP3 file. For now, create a README:

Create `public/sounds/README.md`:
```markdown
# Audio Assets

## Required Files

- `phone-ring.mp3` - Phone ringing sound (loopable)

You can find free phone ring sounds at:
- https://freesound.org/
- https://mixkit.co/free-sound-effects/phone/

Download a suitable phone ring sound and save it as `phone-ring.mp3` in this directory.
```

**Step 3: Commit**

```bash
git add public/sounds/README.md
git commit -m "docs: add placeholder for phone ring sound asset"
```

---

## Task 13: Vercel Configuration

**Files:**
- Create: `vercel.json`
- Create: `README.md`

**Step 1: Create Vercel configuration**

Create `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Step 2: Create project README**

Create `README.md`:
```markdown
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
```

**Step 3: Commit**

```bash
git add vercel.json README.md
git commit -m "docs: add Vercel config and comprehensive README"
```

---

## Task 14: Final Testing & Verification

**Step 1: Test local development server**

Run: `npm run dev`
Expected: Server starts, navigate to http://localhost:5173, see "DRK Anrufsimulator" page

**Step 2: Test routing**

- Navigate to `/` - Should show call interface
- Navigate to `/config` - Should show configuration form
Expected: Both routes work correctly

**Step 3: Test configuration form (without API)**

- Fill out all fields
- Try to submit
Expected: Form validation works, shows error about API (expected since KV not set up locally)

**Step 4: Build production bundle**

Run: `npm run build`
Expected: Build succeeds, creates `dist/` folder

**Step 5: Preview production build**

Run: `npm run preview`
Expected: Production build runs correctly

**Step 6: Commit final state**

```bash
git add .
git commit -m "chore: verify local development and production build"
```

---

## Post-Implementation Checklist

### Before First Deployment

- [ ] Add actual `phone-ring.mp3` file to `public/sounds/`
- [ ] Verify OpenAI API key has Realtime API access
- [ ] Create Vercel project and link repository
- [ ] Add Vercel KV storage to project
- [ ] Set `VITE_OPENAI_API_KEY` environment variable in Vercel
- [ ] Deploy to Vercel
- [ ] Test `/config` route - save a configuration
- [ ] Test `/` route - start a call with microphone access
- [ ] Verify WebSocket connection to OpenAI works
- [ ] Test full conversation flow (ring → answer → speak → conversation → end)

### Optional Enhancements (Post-POC)

- Add error boundary component for graceful error handling
- Add loading skeleton for config page
- Add call duration timer
- Add transcript display (optional, for debugging)
- Improve mobile responsiveness
- Add analytics/logging for conversations
- Implement session timeout (auto-end after N minutes)
- Add support for multiple voices (currently hardcoded to "alloy")

---

## Troubleshooting

### Common Issues

**Microphone not working:**
- Check browser permissions
- Ensure HTTPS in production (getUserMedia requires secure context)
- Check console for specific error messages

**WebSocket connection fails:**
- Verify OpenAI API key is correct and has Realtime API access
- Check browser console for WebSocket errors
- Ensure no firewall blocking WSS connections

**Audio playback issues:**
- Check browser audio permissions
- Ensure AudioContext is created after user interaction
- Verify PCM16 decoding is working correctly

**Config not persisting:**
- Verify Vercel KV is properly configured
- Check environment variables in Vercel dashboard
- Test API endpoints directly: `/api/config/get`

**German not working:**
- Verify system prompt includes German instructions
- Check OpenAI model supports German (gpt-4o-realtime-preview does)
- Review session configuration sent to OpenAI

---

## Implementation Complete

This plan provides step-by-step instructions to build the Red Cross AI Caller POC from scratch. Each task is designed to be completed in 2-5 minutes, with clear commit points for progress tracking.

Follow the tasks sequentially, test frequently, and commit after each task to maintain clean git history and enable easy rollback if needed.
