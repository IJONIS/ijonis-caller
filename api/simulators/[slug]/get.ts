import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type ContactTone = 'Formal' | 'Casual' | 'Friendly';
type RealtimeVoice =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'sage'
  | 'shimmer'
  | 'verse'
  | 'marin'
  | 'cedar';

interface SimulatorMetadata {
  slug: string;
  title: string;
  subtitle: string;
  accentColor: string;
  createdAt: string;
  updatedAt: string;
}

interface PromptConfig {
  agentName: string;
  donorName: string;
  currentAmount: number;
  targetAmount: number;
  donationHistory: string;
  contactTone: ContactTone;
  additionalInstructions?: string;
  voice: RealtimeVoice;
  systemPrompt: string;
}

interface SimulatorConfig extends PromptConfig {
  metadata: SimulatorMetadata;
}

function getKvKey(slug: string): string {
  return `red-cross-caller:simulators:${slug}:config`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' });
  }

  try {
    const config = await kv.get<SimulatorConfig>(getKvKey(slug));

    if (!config) {
      return res.status(404).json({ error: 'Simulator not found' });
    }

    return res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching simulator:', error);
    return res.status(500).json({ error: 'Failed to fetch simulator' });
  }
}
