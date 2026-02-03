import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  DEFAULT_PROMPT_CONFIG,
  generateSystemPrompt,
  type PromptConfig,
} from '../_shared/prompt';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const storedConfig = await kv.get<Partial<PromptConfig>>(
      'red-cross-caller:prompt-config'
    );

    // Merge stored config with defaults
    const config = { ...DEFAULT_PROMPT_CONFIG, ...storedConfig };

    // Generate system prompt if missing or empty
    if (!config.systemPrompt || config.systemPrompt.trim() === '') {
      config.systemPrompt = generateSystemPrompt(config);
    }

    return res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    return res.status(500).json({ error: 'Failed to fetch configuration' });
  }
}
