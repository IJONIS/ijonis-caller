# CLAUDE.md

This file provides guidance to Claude Code when working with the **Ijonis AI Caller** POC project.

## Project Overview

A conversational AI system simulating phone calls using OpenAI's Realtime API over WebRTC for natural German voice conversations.

**Tech Stack:** Vite + React + TypeScript + Tailwind CSS + OpenAI Realtime API (WebRTC) + Vercel Functions + Vercel KV

---

## Development Workflow – Phase-Based Execution

Follow a unified development framework with automatic phase detection, parallel agent orchestration, and MCP server utilization.

### CRITICAL: Parallel Agent Orchestration
**Evaluate after EVERY message**: Identify tasks that can be delegated to specialized agents for parallel execution.

**Agent Delegation Strategy**
- **Multi-file operations** (>3 files): `general-purpose`
- **Python expertise needed**: `python-expert`
- **Architecture decisions**: `system-architect`
- **Code quality/refactoring**: `refactoring-expert`
- **Testing strategy**: `quality-engineer`
- **Performance optimization**: `performance-engineer`
- **Requirements analysis**: `requirements-analyst`
- **Documentation**: `technical-writer`
- **Security validation**: `security-engineer`

**MCP Server Integration** (evaluate and use as needed)
- **Context7**: Official library docs (React, OpenAI, WebRTC)
- **Sequential**: Complex pipeline analysis & system design
- **Playwright**: Browser-based testing for call interface
- **Sanity**: Not used in this project

**Parallel Execution Rules**
1. Always assess if current work can be split across agents
2. Delegate immediately when >3 files or complex analysis is involved
3. Use MCP servers for specialized capabilities (docs, analysis, memory)
4. Coordinate and reconcile agent outputs before proceeding
5. Document delegation in commit messages with agent IDs

**MANDATORY**: Before responding to any request, explicitly state which agents and MCP servers will be utilized and why.

---

## Git Commit Policy

**CRITICAL - NEVER COMMIT WITHOUT EXPLICIT USER APPROVAL**

- **NEVER** run `git commit` or `git push` unless the user explicitly requests it
- **NEVER** commit automatically after completing a task
- **ALWAYS** wait for user to say "commit", "push", "commit and push", or similar explicit instruction
- If unclear whether to commit, **ASK** the user first
- This rule applies to ALL situations, even after completing requested changes

### Git Commit Standards

- **AI co-authorship**: Add `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` at end of commit body
- **Root cause format**: For bugs, explain WHY it existed, HOW solution addresses it, with Fixes/Location/Affected sections
- **Multi-step features**: Reference task/step number, link planning docs, include file:line numbers
- **Implementation details**: List specific technical changes, affected components, new patterns, breaking changes
- **Conventional scopes**: Always use scope prefix: `feat(call)`, `fix(audio)`, `refactor(ui)`, `docs(readme)`, etc.

---

## Clean Code Standards

### File Size Constraints
- Max lines per file: 400 (excl. comments/docstrings)
- Max 50 lines per function
- Max 200 lines per class
- Split modules that exceed limits

### Code Quality Requirements
- **Single Responsibility Principle** per function/class
- **Descriptive Naming**
  - Functions: `handleCallStart()` not `handle()`
  - Vars: `connectionState` not `state1`
  - Classes: `OpenAIRealtimeConnection` not `Connection`
- **No Magic Numbers**: Use named constants
- **Type Hints**: Full TypeScript annotations on all functions
- **JSDoc comments**: Public functions/classes need examples
- **Do not create any fallback or legacy components**. Always fail fast. If something is broken, fix it.

### Maintainability
- Cyclomatic Complexity ≤ 10 per function
- Dependency Injection over hard-coded deps
- Error Boundaries: Wrap WebRTC/Audio operations with try/catch
- Immutable Data preferred; avoid in-place mutation
- Pure Functions where possible
- Configuration: Extract magic strings/values to constants

### Repository Organization
- Logical grouping by domain/module
- Clear, absolute imports; avoid cycles
- Consistent formatting: ESLint configuration
- No dead code: remove unused imports/vars/functions
- Meaningful commit messages with Co-Authored-By
- Self-documenting code via clear naming and structure

### Performance & Security
- Memory: Properly cleanup WebRTC peer connections, media streams, and data channels
- Input Validation at API boundaries
- Logging: Structured console logs with levels (debug/info/warn/error)
- Resource Management: Close peer connections, stop media tracks, remove audio elements
- Security: **NEVER** commit API keys; always use environment variables. API keys must stay server-side.

---

## Project-Specific Architecture Patterns

### 1. OpenAI Realtime API Integration (WebRTC)
**Location**: [`src/lib/openai-realtime.ts`](src/lib/openai-realtime.ts)

- **WebRTC connection**: Ephemeral key from server, RTCPeerConnection with SDP exchange
- **Transport**: WebRTC handles audio natively (echo cancellation, noise suppression, Opus codec, jitter buffering)
- **Data channel**: `oai-events` channel for sending/receiving Realtime API events as JSON
- **Session configuration**: `turn_detection` with `server_vad` for automatic turn-taking
- **German-only**: Explicitly configured in session instructions with prosody guidance
- **Error recovery**: Graceful degradation and user-friendly German error messages

**Connection flow:**
```
1. Client calls POST /api/session → server creates ephemeral key via OpenAI
2. Client creates RTCPeerConnection + audio element + microphone track
3. Client creates data channel "oai-events"
4. Client creates SDP offer → POSTs to OpenAI Realtime endpoint with ephemeral key
5. Client sets SDP answer → WebRTC connection established
6. Audio flows natively via WebRTC; events flow via data channel
```

**Key patterns:**
```typescript
// Session config (sent server-side when creating ephemeral key):
{
  model: 'gpt-4o-realtime-preview',
  voice: 'coral',
  instructions: 'German language conversation...',
  modalities: ['audio', 'text'],
  input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
  turn_detection: {
    type: 'server_vad',
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 750,
  },
}
```

**Microphone constraints:**
```typescript
// Browser audio processing enabled for quality
{
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}
```

**Anti-patterns:**
- Never expose API keys to the browser — use ephemeral keys via server endpoint
- Don't skip proper WebRTC cleanup (peer connection, media tracks, data channel, audio element)
- Never use raw WebSocket for audio when WebRTC is available

### 2. Ephemeral Key Server Endpoint
**Locations**:
- [`api/session.ts`](api/session.ts) — Vercel serverless function (production)
- [`vite-plugin-api.ts`](vite-plugin-api.ts) — Local dev proxy (development)

**Pattern:**
- `POST /api/session` — Creates an ephemeral client secret via OpenAI's `POST /v1/realtime/sessions`
- Server-side only: API key never reaches the browser
- Returns `{ client_secret: { value: "..." } }` — short-lived token for WebRTC SDP exchange
- Accepts `voice` and `instructions` in request body

### 3. Call State Management
**Locations**:
- [`src/components/CallInterface.tsx`](src/components/CallInterface.tsx)
- [`src/components/RingingPhone.tsx`](src/components/RingingPhone.tsx)
- [`src/components/PhoneVisualization.tsx`](src/components/PhoneVisualization.tsx)

**Call flow states:**
1. `idle` - Initial state, show "Anruf starten" button
2. `ringing` - Phone ringing animation, show "Annehmen" button
3. `connecting` - Establishing WebRTC connection, show loader
4. `user_speaking` - User's turn (initial state after connection)
5. `agent_speaking` - AI is speaking
6. `conversation` - Active call, general state
7. `ended` - Call completed, cleanup resources

**State transitions:**
```
idle → ringing (user clicks start)
ringing → connecting (user clicks answer)
connecting → user_speaking (WebRTC data channel opens)
user_speaking ↔ agent_speaking ↔ conversation (during call)
any active state → ended (user hangs up OR error)
ended → idle (after 2s delay)
```

**Critical patterns:**
- User must speak first after answering (VAD handles turn-taking)
- Visual feedback for each state transition
- Proper cleanup on any state transition to `ended`
- Microphone permissions requested during WebRTC setup (part of `connecting`)

### 4. Configuration Management
**Locations**:
- [`api/config/get.ts`](api/config/get.ts)
- [`api/config/update.ts`](api/config/update.ts)
- [`src/pages/Config.tsx`](src/pages/Config.tsx)

**Storage pattern:**
- Vercel KV (Redis) for persistent configuration
- Shared across all users (no multi-tenancy in POC)
- Real-time updates via API endpoints
- Type-safe configuration with TypeScript interfaces

**Configuration structure:**
```typescript
interface PromptConfig {
  agentName: string
  donorName: string
  currentAmount: number
  targetAmount: number
  donationHistory: string
  contactTone: 'Formal' | 'Casual' | 'Friendly'
  additionalInstructions?: string
}
```

**API patterns:**
- `GET /api/config/get` - Retrieve current configuration
- `POST /api/config/update` - Update configuration (returns updated config)
- `POST /api/session` - Create ephemeral key for WebRTC (server-side only)
- Error handling: Return proper HTTP status codes (500 for errors)
- Default values: Provide sensible defaults if KV is empty

### 5. German Language Priority
**Critical requirement**: ALL user-facing text and AI responses MUST be in German.

**Locations:**
- UI strings in all components
- OpenAI session instructions (including prosody guidance)
- Error messages
- Button labels
- Status indicators

**Pattern:**
```typescript
// UI strings
const STRINGS = {
  startCall: 'Anruf starten',
  answerCall: 'Annehmen',
  endCall: 'Anruf beenden',
  connecting: 'Verbindung wird hergestellt',
  // etc.
}
```

---

## Component Communication Patterns

### State Management
- **React hooks**: `useState`, `useEffect`, `useRef` for local state
- **Props drilling**: Keep it shallow (max 2 levels)
- **Ref-based communication**: Use refs for imperative WebRTC operations
- **Callbacks**: Pass callbacks for child-to-parent communication

### Event Handling
- **WebRTC data channel events**: Centralized in `openai-realtime.ts`
- **UI events**: Handled in respective component files
- **Cleanup**: Always remove event listeners in `useEffect` cleanup

### Error Handling
- **User-facing errors**: Show German error messages in UI
- **Developer errors**: Log to console with context
- **Network errors**: WebRTC connection state monitoring for disconnects
- **Audio errors**: Graceful degradation, inform user

---

## Environment Variables

### Required Variables
```bash
# Server-side (used by api/session.ts and vite dev plugin)
VITE_OPENAI_API_KEY=sk-proj-...
# Note: With WebRTC, this key stays server-side. The browser only receives
# a short-lived ephemeral token via POST /api/session.

# For Vercel production, also set as OPENAI_API_KEY in dashboard
OPENAI_API_KEY=sk-proj-...

# Server-side (auto-configured by Vercel)
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

### Environment-Specific Files
- `.env.local` - Local development (git-ignored)
- `.env.production` - Vercel production (via dashboard)

**CRITICAL**: Never commit `.env.local` or expose API keys in source code. The API key must never reach the browser.

---

## Testing Considerations

### Manual Testing Checklist
- [ ] Call starts and phone rings
- [ ] Answer button works and WebRTC connects
- [ ] Ephemeral key is fetched from `/api/session` (check Network tab)
- [ ] User can speak first and AI responds
- [ ] Turn-taking works naturally (VAD)
- [ ] Echo cancellation works (no feedback loop)
- [ ] Call can be ended cleanly
- [ ] Audio resources are released (mic light turns off)
- [ ] Configuration page saves and loads correctly
- [ ] Error states show appropriate German messages
- [ ] Works in Chrome/Safari/Firefox

### Browser Compatibility
- **Preferred**: Chrome/Edge (best WebRTC support)
- **Supported**: Safari (test audio permissions and WebRTC)
- **Known issues**: Firefox may have WebRTC quirks with some STUN/TURN configs

---

## Common Workflows

### Adding New UI Features
1. Check if it affects call state → update state machine in `CallInterface.tsx`
2. Check if it needs German text → add to string constants
3. Check if it needs styling → use Tailwind classes
4. Test on both desktop and mobile viewports

### Modifying OpenAI Behavior
1. Update system prompt in `openai-realtime.ts:buildSystemPrompt()`
2. Update session config in both `api/session.ts` and `vite-plugin-api.ts` (keep in sync)
3. Test with various conversation scenarios
4. Verify German language is maintained
5. Check audio quality and turn-taking timing

### Changing Configuration Options
1. Update `PromptConfig` interface in [`src/types/index.ts`](src/types/index.ts)
2. Update API handlers in `api/config/`
3. Update form in `src/pages/Config.tsx`
4. Test save/load cycle

### Changing Voice or Model
1. Update `REALTIME_MODEL` and `REALTIME_VOICE` constants in `openai-realtime.ts`
2. Update session config in `api/session.ts` and `vite-plugin-api.ts`
3. Test voice quality and German pronunciation

---

## Deployment

### Vercel Deployment
```bash
# Link project (first time)
vercel link

# Deploy to production
vercel --prod
```

### Pre-deployment Checklist
- [ ] `OPENAI_API_KEY` set in Vercel dashboard (for `api/session.ts`)
- [ ] KV storage configured and linked
- [ ] Build passes locally (`npm run build`)
- [ ] No console errors in production build
- [ ] API endpoints tested with production config
- [ ] Ephemeral key endpoint returns valid tokens

---

## File Organization

```
/
├── src/
│   ├── components/       # React components
│   │   ├── CallInterface.tsx      # Main call UI & state machine
│   │   ├── PhoneVisualization.tsx  # Animated phone during call
│   │   └── RingingPhone.tsx        # Ring screen with answer button
│   ├── lib/              # Core logic
│   │   └── openai-realtime.ts     # WebRTC connection manager
│   ├── pages/            # Route pages
│   │   ├── Home.tsx               # Main call page
│   │   └── Config.tsx             # Configuration form
│   ├── types/            # TypeScript definitions
│   │   └── index.ts               # Shared types
│   ├── App.tsx           # Router setup
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── api/                  # Vercel serverless functions
│   ├── session.ts                 # POST /api/session (ephemeral key)
│   └── config/
│       ├── get.ts                 # GET /api/config/get
│       └── update.ts              # POST /api/config/update
├── public/               # Static assets
│   └── sounds/
│       └── phone-ring.wav         # Ring sound
├── vite-plugin-api.ts    # Dev server API proxy (config + session)
├── .env.local            # Local environment (git-ignored)
├── vercel.json           # Vercel configuration
└── vite.config.ts        # Vite build configuration
```

---

## Known Limitations & Future Improvements

### Current Limitations
- No authentication (use Vercel password protection)
- Single shared configuration (no per-user settings)
- No call recording or logging
- No fallback for browsers without WebRTC support

### Potential Improvements
- Multi-user support with separate configurations
- Call transcription and storage
- Analytics dashboard for call metrics
- A/B testing different conversation strategies
- Switch to alternative voice providers (Hume EVI, Gemini Live) for more natural speech

---

## Troubleshooting

### Common Issues

**Issue**: WebRTC connection fails
- Check: `VITE_OPENAI_API_KEY` / `OPENAI_API_KEY` is set correctly
- Check: API key has Realtime API access
- Check: `/api/session` endpoint returns valid ephemeral key (Network tab)
- Check: Browser console for SDP exchange errors
- Check: WebRTC connection state in console logs

**Issue**: No audio input/output
- Check: Browser microphone permissions granted
- Check: Correct audio device selected in browser
- Check: WebRTC peer connection state is 'connected'
- Check: Audio element has `autoplay` set

**Issue**: Echo or feedback
- Check: `echoCancellation: true` in getUserMedia constraints
- Check: Using headphones for testing (recommended)

**Issue**: Phone ring sound doesn't play
- Check: `public/sounds/phone-ring.wav` exists
- Check: File path is correct in component
- Check: Browser autoplay policy (user interaction required)

**Issue**: Configuration not saving
- Check: Vercel KV is properly configured
- Check: Environment variables are set in Vercel dashboard
- Check: API endpoint logs in Vercel function logs

**Issue**: AI responds in English instead of German
- Check: Session instructions in `openai-realtime.ts:buildSystemPrompt()`
- Check: Configuration page language settings
- Verify: Instructions are passed correctly to `/api/session`

---

## Security Considerations

### API Key Protection
- **NEVER** commit API keys to git
- API keys stay server-side only (in `api/session.ts` and `vite-plugin-api.ts`)
- Browser only receives short-lived ephemeral tokens
- Rotate keys if accidentally exposed

### Data Privacy
- No sensitive donor data stored client-side
- Configuration in secure Vercel KV
- No call recording by default (respect GDPR)
- Consider adding consent mechanisms for production

### Network Security
- WebRTC connections are encrypted (DTLS/SRTP)
- API endpoints use HTTPS
- Vercel password protection for POC deployment
- Consider proper authentication for production

---

## Additional Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Realtime WebRTC Guide](https://platform.openai.com/docs/guides/realtime-webrtc)
- [OpenAI Client Secrets API](https://platform.openai.com/docs/api-reference/realtime-sessions)
- [WebRTC MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
- [React Router](https://reactrouter.com/)

---

**Last Updated**: 2026-02-03
**Project Status**: Proof of Concept
**Maintainer**: Ijonis Team
