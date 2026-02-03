import { loadEnv, type Plugin } from 'vite';

const DEFAULT_CONFIG = {
  agentName: 'Sarah',
  agentRole: 'Spenderbetreuung',
  agentDialect: 'Hamburg',
  agentYearsExperience: 3,

  speakingPace: 'Normal',
  useFillers: true,
  showEmotion: true,

  followUpOnTopics: true,
  allowDigressions: true,
  waitForDonorFirst: true,

  donorName: 'Max Mustermann',
  currentAmount: 20,
  targetAmount: 35,
  donationHistory: '2 Jahre',
  contactTone: 'Friendly',

  additionalInstructions: '',
  customPersonality: '',
};

let storedConfig = { ...DEFAULT_CONFIG };

export function apiPlugin(): Plugin {
  let env: Record<string, string> = {};

  return {
    name: 'vite-plugin-api',
    configResolved(config) {
      env = loadEnv(config.mode, config.envDir, '');
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

              // If no password configured, allow access
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

        // Handle GET /api/config/get
        if (req.url === '/api/config/get' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(storedConfig));
          return;
        }

        // Handle POST /api/config/update
        if (req.url === '/api/config/update' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const updates = JSON.parse(body);
              storedConfig = { ...storedConfig, ...updates };
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(storedConfig));
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
