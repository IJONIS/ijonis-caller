# Red Cross AI Caller - Proof of Concept Design

**Date:** 2026-01-29
**Purpose:** State-of-the-art conversational AI mimicking a Red Cross calling agent for donation upselling

---

## Overview

A web application that simulates a realistic phone call from a Red Cross agent attempting to upsell donors through natural German conversation. The system uses OpenAI's Realtime API for bidirectional voice communication with automatic voice activity detection.

---

## Core User Experience

### Main Call Flow
1. User clicks "Start Call" button
2. Phone rings with animation and sound
3. User clicks "Answer Call"
4. Brief connection phase
5. **User speaks first** - says "Hello?" or similar greeting
6. AI agent responds in German, introduces itself
7. Natural conversation ensues with automatic turn-taking (VAD)
8. Phone visualization animates when agent speaks
9. User clicks "End Call" to terminate
10. Returns to initial state

### Configuration Flow
1. Navigate directly to `/config` URL (no UI link)
2. Fill form with donor details and agent configuration
3. Save settings (persisted in Vercel KV for all users)
4. Settings immediately available for next call session

---

## Technical Architecture

### Technology Stack
- **Frontend Framework:** Vite + React + TypeScript
- **Styling:** Tailwind CSS
- **Real-time API:** OpenAI Realtime API (WebSocket)
- **Audio Processing:** Web Audio API + MediaRecorder
- **Backend:** Vercel Serverless Functions
- **Data Storage:** Vercel KV (Redis)
- **Deployment:** Vercel
- **Language:** Hardcoded German for all agent responses

### Project Structure
```
/src
  /components
    - CallInterface.tsx          # Main call UI with state management
    - PhoneVisualization.tsx     # iOS-style animated speaking indicator
    - RingingPhone.tsx           # Ring animation and answer button
  /pages
    - Home.tsx                   # Main call page (/)
    - Config.tsx                 # Configuration form (/config)
  /lib
    - openai-realtime.ts         # WebSocket connection & event handling
    - audio-processor.ts         # Microphone capture, audio playback
  /api
    - config/get.ts              # GET endpoint for fetching settings
    - config/update.ts           # POST endpoint for updating settings
  /public
    /sounds
      - phone-ring.mp3           # Ringing sound effect
```

---

## Application States

### Call States
1. **IDLE** - Initial state with "Start Call" button
2. **RINGING** - Phone ringing animation, "Answer" button visible
3. **CONNECTING** - Brief WebSocket establishment phase
4. **USER_SPEAKING** - Waiting for user's first utterance
5. **AGENT_SPEAKING** - AI agent talking (visualization active)
6. **CONVERSATION** - Active back-and-forth dialogue
7. **ENDED** - Call terminated, cleanup complete

### State Transitions
- IDLE → RINGING (user clicks "Start Call")
- RINGING → CONNECTING (user clicks "Answer")
- CONNECTING → USER_SPEAKING (WebSocket ready, mic active)
- USER_SPEAKING ↔ AGENT_SPEAKING (VAD-driven turn-taking)
- Any state → ENDED (user clicks "End Call" or connection fails)
- ENDED → IDLE (automatic after brief delay)

---

## OpenAI Realtime API Integration

### WebSocket Configuration
**Endpoint:**
```
wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview
```

**Session Parameters:**
```typescript
{
  type: "session.update",
  session: {
    model: "gpt-4o-realtime-preview",
    modalities: ["audio", "text"],
    voice: "alloy", // or another suitable voice
    input_audio_format: "pcm16",
    output_audio_format: "pcm16",
    input_audio_transcription: {
      model: "whisper-1"
    },
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500
    },
    instructions: `${dynamicPromptFromKV}

CRITICAL: You MUST speak in German at all times.
You are calling a German-speaking donor.
All responses must be in fluent, natural German.`
  }
}
```

### Key WebSocket Events

**Outgoing (Client → OpenAI):**
- `session.update` - Initial configuration with dynamic German prompt
- `input_audio_buffer.append` - Stream microphone audio (base64 PCM16)
- `input_audio_buffer.commit` - Finalize audio segment
- `response.cancel` - Stop agent mid-speech if needed

**Incoming (OpenAI → Client):**
- `session.created` - Connection established
- `conversation.item.created` - User speech detected
- `response.audio.delta` - Agent voice chunks (stream to speaker)
- `response.audio.done` - Agent finished speaking
- `conversation.item.input_audio_transcription.completed` - User speech text (for debugging)
- `response.text.delta` - Agent text response (for debugging/logging)
- `error` - Error conditions

### Dynamic Prompt Injection

On WebSocket connection, fetch configuration from Vercel KV and build system prompt:

```typescript
const config = await kv.get('red-cross-caller:prompt-config');

const systemPrompt = `
Du bist ${config.agentName}, und du rufst ${config.donorName} vom Deutschen Roten Kreuz an.

Spender-Informationen:
- Aktueller monatlicher Spendenbetrag: €${config.currentAmount}
- Ziel-Spendenbetrag: €${config.targetAmount}
- Spendenhistorie: ${config.donationHistory}
- Kontaktton: ${config.contactTone}

Zusätzliche Anweisungen:
${config.additionalInstructions}

WICHTIG: Sprich natürlich und authentisch auf Deutsch.
Dein Ziel ist es, ${config.donorName} durch psychologische Gesprächsführung
dazu zu bewegen, die monatliche Spende auf €${config.targetAmount} zu erhöhen.

KRITISCH: Du MUSST zu jeder Zeit auf Deutsch sprechen.
Alle Antworten müssen in fließendem, natürlichem Deutsch sein.
`;
```

---

## Configuration Page Design

### Route
`/config` - Direct URL access only, no navigation link in UI

### Form Fields

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| **Agent Name** | Text input | AI agent's name (e.g., "Sarah", "Michael") | Required |
| **Donor Name** | Text input | Person being called | Required |
| **Current Donation** | Number input (€) | Current monthly amount | Required, > 0 |
| **Target Upsell** | Number input (€) | Desired monthly amount | Required, > current |
| **Donation History** | Text input | How long they've donated (e.g., "2 Jahre") | Required |
| **Contact Tone** | Dropdown | "Formal", "Casual", "Friendly" | Required |
| **Additional Instructions** | Textarea | Custom tactics, notes, special considerations | Optional |

### Data Storage

**Vercel KV Key:** `red-cross-caller:prompt-config`

**Value Structure:**
```typescript
interface PromptConfig {
  agentName: string;
  donorName: string;
  currentAmount: number;
  targetAmount: number;
  donationHistory: string;
  contactTone: 'Formal' | 'Casual' | 'Friendly';
  additionalInstructions?: string;
}
```

### API Endpoints

**GET `/api/config`**
- Returns current configuration from KV
- Returns default values if no config exists

**POST `/api/config`**
- Validates incoming data
- Updates KV storage
- Returns success/error response

---

## UI Component Design

### Main Call Page (`/`)

#### Initial State
- Clean, centered layout
- Large primary "Start Call" button
- Red Cross branding color (#ED1B2E)
- Minimal white/light background

#### Ringing State
- Phone icon with pulsing animation
- Looping phone ring sound
- Prominent "Answer Call" button (green)
- Secondary "Decline" button (returns to IDLE)

#### Active Call State
**Layout:**
- **Top:** "Red Cross Call in Progress" header
- **Center:** Phone visualization component
- **Bottom:** "End Call" button (red, always visible)

**Phone Visualization:**
- Circular design (iOS call screen style)
- When **agent speaking:** Animated concentric circles pulsing outward
- When **user speaking:** Static or subtle pulse
- Center: Red Cross logo or microphone icon
- Colors: Red Cross red (#ED1B2E) with opacity variations
- Smooth CSS animations synced to audio amplitude
- Optional text indicator: "Listening..." / "Agent speaking..."

**Visual Polish:**
- Smooth state transitions (fade/slide animations)
- Loading spinners during CONNECTING
- Mobile-first responsive design
- Accessibility: ARIA labels, focus states, keyboard navigation

### Configuration Page (`/config`)

**Layout:**
- Simple form layout with clear labels
- Grouped sections (donor info, agent settings, tactics)
- "Save Configuration" button at bottom
- Success message on save: "Konfiguration erfolgreich gespeichert"
- Shows current values on page load
- Minimal validation errors inline

---

## Audio Processing Implementation

### Microphone Capture
1. Request permission: `navigator.mediaDevices.getUserMedia({ audio: true })`
2. Create MediaRecorder or use Web Audio API AudioContext
3. Capture audio in chunks (ideally PCM16 at 24kHz)
4. Convert to base64 encoding
5. Send via WebSocket: `input_audio_buffer.append` events
6. Chunk size: ~100ms of audio per message

### Audio Playback
1. Receive `response.audio.delta` events with base64 PCM16
2. Decode base64 → ArrayBuffer
3. Use Web Audio API:
   - Create AudioContext
   - Create AudioBufferSourceNode for each chunk
   - Schedule playback to maintain continuity
   - Buffer management to prevent gaps/dropouts
4. Update visualization based on audio amplitude

### Voice Activity Detection (VAD)
- **Mode:** Server-side VAD (`server_vad`)
- OpenAI automatically detects when user stops speaking
- Agent response triggered automatically
- No manual button presses during conversation
- User has full hands-free experience

### Ringing Sound
- Audio file: `/public/sounds/phone-ring.mp3`
- Play on loop during RINGING state
- Stop playback on "Answer" click
- Fallback to silent mode if audio fails to load

---

## Error Handling Strategy

### Connection Failures
**Scenario:** WebSocket fails to connect or disconnects during call

**Response:**
1. Display clear modal: "Verbindung unterbrochen" (Connection lost)
2. Automatically transition to ENDED state
3. Show "Erneut versuchen" (Retry) button on main screen
4. No automatic reconnection attempts
5. Clean up resources (close mic, stop audio)

### Microphone Permission Denied
**Scenario:** User denies microphone access

**Response:**
1. Display error message: "Mikrofonzugriff erforderlich" (Microphone access required)
2. Provide instructions for enabling permissions
3. Return to IDLE state
4. Show "Erneut versuchen" button

### API Errors
**Scenario:** OpenAI API returns error (rate limit, invalid key, etc.)

**Response:**
1. Log error to console for debugging
2. Display user-friendly message: "Ein Fehler ist aufgetreten" (An error occurred)
3. Return to IDLE state
4. Optional: Display error code for troubleshooting

### Unexpected Disconnections
**Scenario:** Network issues, browser tab backgrounded, etc.

**Response:**
- Same as connection failures above
- No persistent retry logic (per design decision)
- User must manually restart call

---

## Environment Variables

### Required for Development & Production

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-proj-...

# Vercel KV (automatically provided in Vercel deployment)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

### Local Development
- Create `.env.local` file with above variables
- Vercel KV requires either:
  - Local Redis instance for testing, OR
  - Use Vercel dev environment linked to cloud KV

---

## Deployment Checklist

### Vercel Setup
1. Create new Vercel project linked to GitHub repo
2. Add Vercel KV storage to project (free tier)
3. Set environment variables (OPENAI_API_KEY)
4. Deploy main branch
5. Verify `/` route loads correctly
6. Test `/config` route accessibility
7. Verify KV read/write functionality

### Access Control
- **Application-level:** None (POC requires Vercel access controls)
- **Vercel-level:** Use Vercel's built-in password protection for entire deployment
- Anyone with deployment access can use both `/` and `/config`

### Testing Workflow
1. Configure prompt settings via `/config`
2. Test call flow on `/`
3. Iterate on prompt configuration
4. Monitor OpenAI API usage/costs
5. Test error scenarios (disconnect, denied mic, etc.)

---

## Future Considerations (Post-POC)

**Not included in initial implementation, but potential enhancements:**

- Multi-language support (English, French, etc.)
- Call recording and playback
- Analytics dashboard (conversion rates, call duration)
- A/B testing different prompts/strategies
- Authentication and user management
- Call history and session logs
- Real-time transcription display during call
- Admin dashboard for reviewing calls
- Integration with actual donor database
- Webhook notifications on successful upsells

---

## Success Metrics for POC

**Primary Goal:** Validate natural conversation quality in German

**Key Evaluation Criteria:**
1. **Naturalness:** Does the conversation feel like a real phone call?
2. **Turn-taking:** Does VAD correctly detect speaker changes?
3. **Persuasiveness:** Do the psychological tactics feel authentic?
4. **Technical Stability:** Does audio quality remain consistent?
5. **Ease of Iteration:** Can prompts be updated quickly for testing?

**Testing Approach:**
- Conduct multiple test calls with different prompt configurations
- Gather qualitative feedback on conversation flow
- Identify awkward pauses or interruptions
- Refine prompt based on observed behaviors
- Test edge cases (interruptions, long silences, background noise)

---

## Technical Constraints & Assumptions

### Browser Compatibility
- Modern browsers with WebSocket support (Chrome, Firefox, Safari, Edge)
- Web Audio API support required
- MediaRecorder API or equivalent for audio capture
- No IE11 support needed

### Audio Requirements
- User must have working microphone
- Stable internet connection (WebSocket requires persistent connection)
- Audio latency: Aim for <500ms round-trip
- Background noise may affect VAD accuracy

### OpenAI API Limitations
- Rate limits per usage tier
- Model availability (gpt-4o-realtime-preview)
- Voice options for German language
- WebSocket timeout settings (typically 30-60 minutes)

### Vercel Constraints
- Serverless function timeout: 10 seconds (Hobby), 60s (Pro)
- KV storage limits: 256 MB (Hobby tier)
- Concurrent WebSocket connections limited by plan

---

## Development Phases

### Phase 1: Foundation (Week 1)
- Set up Vite + React project
- Configure Tailwind CSS
- Create basic routing (`/` and `/config`)
- Implement UI states (IDLE, RINGING, ACTIVE, ENDED)
- Build configuration form and API endpoints
- Set up Vercel KV integration

### Phase 2: OpenAI Integration (Week 1-2)
- Implement WebSocket connection to Realtime API
- Build audio capture pipeline
- Build audio playback pipeline
- Integrate dynamic prompt loading from KV
- Test basic voice conversation flow
- Ensure German language responses

### Phase 3: Polish & Testing (Week 2)
- Implement phone visualization component
- Add ringing sound and animations
- Refine error handling
- Test edge cases and error scenarios
- Optimize audio quality and latency
- User acceptance testing

### Phase 4: Deployment (Week 2)
- Deploy to Vercel
- Configure KV storage in production
- Set up password protection
- Final testing in production environment
- Documentation for stakeholders

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI API costs too high | High | Monitor usage, implement session time limits |
| WebSocket instability | High | Clear error messages, easy retry flow |
| Poor German voice quality | High | Test multiple voice options, refine prompts |
| VAD false positives | Medium | Tune VAD parameters, consider fallback to push-to-talk |
| Microphone compatibility | Medium | Test across browsers, provide clear permission instructions |
| Vercel KV limits exceeded | Low | Monitor usage, upgrade tier if needed |

---

## Conclusion

This design provides a complete blueprint for a proof-of-concept Red Cross AI caller that prioritizes:
- **Natural conversation flow** (user speaks first, VAD-driven)
- **Easy iteration** (shared configuration via Vercel KV)
- **Clean, minimal UI** (focused on call experience)
- **Quick implementation** (leveraging Vercel + OpenAI ecosystem)
- **German-first approach** (hardcoded language for authenticity)

The architecture is intentionally simple to enable rapid testing and refinement of the core conversational experience, which is the primary goal of this POC.
