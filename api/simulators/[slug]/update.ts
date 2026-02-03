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

interface SimulatorIndex {
  simulators: SimulatorMetadata[];
  defaultSlug: string;
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

const KV_INDEX_KEY = 'red-cross-caller:simulators:index';

function getKvKey(slug: string): string {
  return `red-cross-caller:simulators:${slug}:config`;
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/.test(slug) || /^[a-z0-9]$/.test(slug);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' });
  }

  try {
    const body = req.body as Partial<SimulatorConfig>;

    // Validate required fields
    if (!body.agentName || body.agentName.trim() === '') {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    if (!body.donorName || body.donorName.trim() === '') {
      return res.status(400).json({ error: 'Donor name is required' });
    }
    if (typeof body.currentAmount !== 'number' || body.currentAmount <= 0) {
      return res.status(400).json({ error: 'Current amount must be positive' });
    }
    if (typeof body.targetAmount !== 'number' || body.targetAmount <= body.currentAmount) {
      return res.status(400).json({ error: 'Target amount must be greater than current amount' });
    }
    if (!['Formal', 'Casual', 'Friendly'].includes(body.contactTone || '')) {
      return res.status(400).json({ error: 'Invalid contact tone' });
    }
    if (!body.systemPrompt || body.systemPrompt.length < 10) {
      return res.status(400).json({ error: 'System prompt must be at least 10 characters' });
    }
    if (!body.metadata) {
      return res.status(400).json({ error: 'Metadata is required' });
    }
    if (!body.metadata.title || body.metadata.title.trim() === '') {
      return res.status(400).json({ error: 'Simulator title is required' });
    }
    if (!body.metadata.subtitle || body.metadata.subtitle.trim() === '') {
      return res.status(400).json({ error: 'Simulator subtitle is required' });
    }
    if (!isValidHexColor(body.metadata.accentColor || '')) {
      return res.status(400).json({ error: 'Invalid accent color (must be hex format like #C41E3A)' });
    }

    // Get current index
    const index = await kv.get<SimulatorIndex>(KV_INDEX_KEY);
    if (!index) {
      return res.status(500).json({ error: 'Simulator index not found' });
    }

    // Check if this is an existing simulator or new one
    const existingConfig = await kv.get<SimulatorConfig>(getKvKey(slug));
    const isNew = !existingConfig;

    // Handle slug change for existing simulators
    const newSlug = body.metadata.slug;
    if (!newSlug || !isValidSlug(newSlug)) {
      return res.status(400).json({ error: 'Invalid slug (lowercase alphanumeric and hyphens only)' });
    }

    const slugChanged = !isNew && newSlug !== slug;

    // Check if new slug already exists (if changing)
    if (slugChanged) {
      const existingWithNewSlug = await kv.get<SimulatorConfig>(getKvKey(newSlug));
      if (existingWithNewSlug) {
        return res.status(400).json({ error: 'A simulator with this slug already exists' });
      }
    }

    // Check if new simulator slug already exists
    if (isNew) {
      const existingWithSlug = await kv.get<SimulatorConfig>(getKvKey(newSlug));
      if (existingWithSlug) {
        return res.status(400).json({ error: 'A simulator with this slug already exists' });
      }
    }

    const now = new Date().toISOString();

    // Build the config
    const config: SimulatorConfig = {
      agentName: body.agentName,
      donorName: body.donorName,
      currentAmount: body.currentAmount,
      targetAmount: body.targetAmount,
      donationHistory: body.donationHistory || '',
      contactTone: body.contactTone as ContactTone,
      additionalInstructions: body.additionalInstructions || '',
      voice: body.voice || 'marin',
      systemPrompt: body.systemPrompt,
      metadata: {
        slug: newSlug,
        title: body.metadata.title,
        subtitle: body.metadata.subtitle,
        accentColor: body.metadata.accentColor,
        createdAt: existingConfig?.metadata.createdAt || now,
        updatedAt: now,
      },
    };

    // Save the config with the new slug
    await kv.set(getKvKey(newSlug), config);

    // If slug changed, delete old key
    if (slugChanged) {
      await kv.del(getKvKey(slug));
    }

    // Update index
    const updatedIndex: SimulatorIndex = {
      ...index,
      simulators: slugChanged || isNew
        ? [
            ...index.simulators.filter((s) => s.slug !== slug && s.slug !== newSlug),
            config.metadata,
          ]
        : index.simulators.map((s) => (s.slug === slug ? config.metadata : s)),
    };

    // If default slug was changed, update it
    if (slugChanged && index.defaultSlug === slug) {
      updatedIndex.defaultSlug = newSlug;
    }

    await kv.set(KV_INDEX_KEY, updatedIndex);

    return res.status(200).json({
      success: true,
      config,
      slugChanged,
      newSlug: slugChanged ? newSlug : undefined,
    });
  } catch (error) {
    console.error('Error updating simulator:', error);
    return res.status(500).json({ error: 'Failed to update simulator' });
  }
}
