import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type ContactTone = 'Formal' | 'Casual' | 'Friendly';

interface PromptConfig {
  agentName: string;
  donorName: string;
  currentAmount: number;
  targetAmount: number;
  donationHistory: string;
  contactTone: ContactTone;
  additionalInstructions?: string;
  systemPrompt: string;
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

    if (!config.systemPrompt || config.systemPrompt.trim().length < 10) {
      return res.status(400).json({ error: 'System prompt is required' });
    }

    await kv.set('ijonis-caller:prompt-config', config);

    return res.status(200).json({ success: true, config });
  } catch (error) {
    console.error('Error updating config:', error);
    return res.status(500).json({ error: 'Failed to update configuration' });
  }
}
