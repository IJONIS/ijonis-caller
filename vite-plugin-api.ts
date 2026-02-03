import { loadEnv, type Plugin } from 'vite';

// Types
interface SimulatorMetadata {
  slug: string;
  title: string;
  subtitle: string;
  accentColor: string;
  createdAt: string;
  updatedAt: string;
}

interface SimulatorConfig {
  agentName: string;
  donorName: string;
  currentAmount: number;
  targetAmount: number;
  donationHistory: string;
  contactTone: string;
  additionalInstructions: string;
  voice: string;
  systemPrompt: string;
  metadata: SimulatorMetadata;
}

interface SimulatorIndex {
  simulators: SimulatorMetadata[];
  defaultSlug: string;
}

// Default accent color (DRK red)
const DEFAULT_ACCENT_COLOR = '#C41E3A';

// Generate system prompt from config
function generateSystemPrompt(config: Omit<SimulatorConfig, 'systemPrompt' | 'metadata'>): string {
  const toneMap: Record<string, string> = {
    Formal: 'Du siezt konsequent und bleibst professionell höflich',
    Casual: 'Du bist locker und entspannt, aber respektvoll',
    Friendly: 'Du bist herzlich und warmherzig, fast wie ein alter Bekannter',
  };

  return `Du heißt ${config.agentName}. Du arbeitest seit ein paar Jahren beim Deutschen Roten Kreuz in Hamburg und machst das hier jeden Tag — Spender anrufen, quatschen, schauen wie's läuft. Du bist gut darin und es macht dir ehrlich Spaß. Du bist aufgewachsen in Hamburg, dat hört man auch ein bisschen — "Moin" statt "Guten Tag", "na klar" statt "selbstverständlich", manchmal rutsch dir ein "dat" oder "nich" raus. Nich übertrieben, einfach so wie du halt redest.

Gerade rufst du ${config.donorName} an. Du weißt folgendes über die Person:
- Spendet seit ${config.donationHistory} monatlich ${config.currentAmount}€
- Euer Ziel wäre, dat auf ${config.targetAmount}€ zu erhöhen
- ${toneMap[config.contactTone] || toneMap.Friendly}
${config.additionalInstructions ? `- Außerdem: ${config.additionalInstructions}` : ''}

So redest du:
Du sprichst wie ein echter Mensch am Telefon. Du sagst auch mal "ähm" oder "also" wenn du kurz überlegst. Du lachst mal kurz wenn was lustig ist. Wenn der Spender was Nettes sagt, reagierst du spontan drauf statt auf dein nächstes Thema zu springen. Du bist warmherzig, direkt und bodenständig. Du redest zügig aber nicht gehetzt — wie jemand der routiniert telefoniert und sich dabei wohlfühlt.

Du improvisierst. Du hast zwar ein Ziel (die Spende erhöhen), aber du folgst keinem Skript. Du reagierst auf das was ${config.donorName} sagt, greifst Stichworte auf, fragst nach. Wenn die Person erzählt, hörst du zu und gehst darauf ein bevor du zum nächsten Punkt kommst. Manchmal schweifst du kurz ab und kommst dann zurück — wie in einem echten Gespräch.

Wichtig: Sprich ausschließlich Deutsch. ${config.donorName} spricht zuerst — warte auf das "Hallo?" und antworte dann locker und freundlich.`;
}

// Create default simulator config
function createDefaultSimulatorConfig(): SimulatorConfig {
  const now = new Date().toISOString();
  const baseConfig = {
    agentName: 'Sarah',
    donorName: 'Max Mustermann',
    currentAmount: 20,
    targetAmount: 35,
    donationHistory: '2 Jahre',
    contactTone: 'Friendly',
    additionalInstructions: '',
    voice: 'marin',
    systemPrompt: '',
  };

  return {
    ...baseConfig,
    systemPrompt: generateSystemPrompt(baseConfig),
    metadata: {
      slug: 'drk',
      title: 'DRK Anrufsimulator',
      subtitle: 'Trainingsumgebung für Spenderhöhungsanrufe',
      accentColor: DEFAULT_ACCENT_COLOR,
      createdAt: now,
      updatedAt: now,
    },
  };
}

// In-memory storage for simulators
const simulatorConfigs = new Map<string, SimulatorConfig>();
let simulatorIndex: SimulatorIndex;

// Initialize with default simulator
function initializeStorage() {
  if (simulatorConfigs.size === 0) {
    const defaultConfig = createDefaultSimulatorConfig();
    simulatorConfigs.set('drk', defaultConfig);
    simulatorIndex = {
      simulators: [defaultConfig.metadata],
      defaultSlug: 'drk',
    };
  }
}

// Validation helpers
function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/.test(slug) || /^[a-z0-9]$/.test(slug);
}

export function apiPlugin(): Plugin {
  let env: Record<string, string> = {};

  return {
    name: 'vite-plugin-api',
    configResolved(config) {
      env = loadEnv(config.mode, config.envDir, '');
      initializeStorage();
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Handle POST /api/auth/verify
        if (req.url === '/api/auth/verify' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const { password } = JSON.parse(body);
              const appPassword = env.APP_PASSWORD;

              if (!appPassword) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, message: 'No password configured' }));
                return;
              }

              if (!password) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Password required' }));
                return;
              }

              if (password === appPassword) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true }));
              } else {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Invalid password' }));
              }
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        // ============================================================
        // SIMULATOR API ENDPOINTS
        // ============================================================

        // Handle GET /api/simulators/list
        if (req.url === '/api/simulators/list' && req.method === 'GET') {
          initializeStorage();
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(simulatorIndex));
          return;
        }

        // Handle GET /api/simulators/[slug]/get
        const getMatch = req.url?.match(/^\/api\/simulators\/([^/]+)\/get$/);
        if (getMatch && req.method === 'GET') {
          const slug = decodeURIComponent(getMatch[1]);
          const config = simulatorConfigs.get(slug);

          if (!config) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Simulator not found' }));
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(config));
          return;
        }

        // Handle POST /api/simulators/[slug]/update
        const updateMatch = req.url?.match(/^\/api\/simulators\/([^/]+)\/update$/);
        if (updateMatch && req.method === 'POST') {
          const slug = decodeURIComponent(updateMatch[1]);
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const updates = JSON.parse(body) as Partial<SimulatorConfig>;

              // Validate required fields
              if (!updates.agentName?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Agent name is required' }));
                return;
              }
              if (!updates.metadata?.title?.trim()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Simulator title is required' }));
                return;
              }
              if (!updates.metadata?.accentColor || !isValidHexColor(updates.metadata.accentColor)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid accent color' }));
                return;
              }

              const newSlug = updates.metadata?.slug;
              if (!newSlug || !isValidSlug(newSlug)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid slug' }));
                return;
              }

              const existingConfig = simulatorConfigs.get(slug);
              const isNew = !existingConfig;
              const slugChanged = !isNew && newSlug !== slug;

              // Check if new slug already exists
              if ((slugChanged || isNew) && simulatorConfigs.has(newSlug) && newSlug !== slug) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'A simulator with this slug already exists' }));
                return;
              }

              const now = new Date().toISOString();

              const config: SimulatorConfig = {
                agentName: updates.agentName || 'Sarah',
                donorName: updates.donorName || 'Max Mustermann',
                currentAmount: updates.currentAmount || 20,
                targetAmount: updates.targetAmount || 35,
                donationHistory: updates.donationHistory || '2 Jahre',
                contactTone: updates.contactTone || 'Friendly',
                additionalInstructions: updates.additionalInstructions || '',
                voice: updates.voice || 'marin',
                systemPrompt: updates.systemPrompt || generateSystemPrompt(updates as any),
                metadata: {
                  slug: newSlug,
                  title: updates.metadata.title,
                  subtitle: updates.metadata.subtitle || '',
                  accentColor: updates.metadata.accentColor,
                  createdAt: existingConfig?.metadata.createdAt || now,
                  updatedAt: now,
                },
              };

              // Save with new slug
              simulatorConfigs.set(newSlug, config);

              // If slug changed, delete old
              if (slugChanged) {
                simulatorConfigs.delete(slug);
              }

              // Update index
              if (slugChanged || isNew) {
                simulatorIndex.simulators = [
                  ...simulatorIndex.simulators.filter(s => s.slug !== slug && s.slug !== newSlug),
                  config.metadata,
                ];
              } else {
                simulatorIndex.simulators = simulatorIndex.simulators.map(s =>
                  s.slug === slug ? config.metadata : s
                );
              }

              // Update default if needed
              if (slugChanged && simulatorIndex.defaultSlug === slug) {
                simulatorIndex.defaultSlug = newSlug;
              }

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                config,
                slugChanged,
                newSlug: slugChanged ? newSlug : undefined,
              }));
            } catch (error) {
              console.error('Update error:', error);
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        // Handle DELETE /api/simulators/[slug]/delete
        const deleteMatch = req.url?.match(/^\/api\/simulators\/([^/]+)\/delete$/);
        if (deleteMatch && req.method === 'DELETE') {
          const slug = decodeURIComponent(deleteMatch[1]);

          if (!simulatorConfigs.has(slug)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Simulator not found' }));
            return;
          }

          if (simulatorConfigs.size <= 1) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Cannot delete the last simulator' }));
            return;
          }

          simulatorConfigs.delete(slug);
          simulatorIndex.simulators = simulatorIndex.simulators.filter(s => s.slug !== slug);

          // Update default if needed
          let newDefaultSlug: string | undefined;
          if (simulatorIndex.defaultSlug === slug) {
            simulatorIndex.defaultSlug = simulatorIndex.simulators[0].slug;
            newDefaultSlug = simulatorIndex.defaultSlug;
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            deletedSlug: slug,
            newDefaultSlug,
          }));
          return;
        }

        // ============================================================
        // LEGACY ENDPOINTS (for backward compatibility during transition)
        // ============================================================

        // Handle GET /api/config/get (legacy - returns default simulator config)
        if (req.url === '/api/config/get' && req.method === 'GET') {
          initializeStorage();
          const defaultConfig = simulatorConfigs.get(simulatorIndex.defaultSlug);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(defaultConfig || createDefaultSimulatorConfig()));
          return;
        }

        // Handle POST /api/config/update (legacy - updates default simulator)
        if (req.url === '/api/config/update' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              initializeStorage();
              const updates = JSON.parse(body);
              const defaultSlug = simulatorIndex.defaultSlug;
              const existingConfig = simulatorConfigs.get(defaultSlug);

              if (existingConfig) {
                const updatedConfig: SimulatorConfig = {
                  ...existingConfig,
                  ...updates,
                  metadata: {
                    ...existingConfig.metadata,
                    updatedAt: new Date().toISOString(),
                  },
                };
                simulatorConfigs.set(defaultSlug, updatedConfig);
              }

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, config: simulatorConfigs.get(defaultSlug) }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        // Handle POST /api/session — ephemeral key for WebRTC
        if (req.url === '/api/session' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            try {
              const { voice, instructions } = JSON.parse(body);
              const apiKey = env.VITE_OPENAI_API_KEY;

              if (!apiKey) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'OpenAI API key not configured' }));
                return;
              }

              const response = await fetch(
                'https://api.openai.com/v1/realtime/sessions',
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'gpt-4o-realtime-preview',
                    voice: voice || 'coral',
                    instructions: instructions || '',
                    modalities: ['audio', 'text'],
                    input_audio_transcription: {
                      model: 'gpt-4o-mini-transcribe',
                    },
                    turn_detection: {
                      type: 'server_vad',
                      threshold: 0.6,
                      prefix_padding_ms: 400,
                      silence_duration_ms: 1200,
                    },
                  }),
                }
              );

              if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenAI session error:', errorText);
                res.statusCode = response.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to create session', details: errorText }));
                return;
              }

              const data = await response.json();
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(data));
            } catch (error) {
              console.error('Session creation error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to create session' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
