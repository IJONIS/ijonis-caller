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

const KV_INDEX_KEY = 'ijonis-caller:simulators:index';

function getKvKey(slug: string): string {
  return `ijonis-caller:simulators:${slug}:config`;
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/.test(slug) || /^[a-z0-9]$/.test(slug);
}

/**
 * Catch-all handler for /api/simulators/[slug]/[action]
 * Routes: GET /api/simulators/{slug}/get
 *         POST /api/simulators/{slug}/update
 *         DELETE /api/simulators/{slug}/delete
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Parse the path segments from the catch-all parameter
  const pathParam = req.query.path;
  const pathSegments = Array.isArray(pathParam) ? pathParam : [pathParam];

  if (pathSegments.length !== 2) {
    return res.status(400).json({ error: 'Invalid path. Expected /api/simulators/{slug}/{action}' });
  }

  const [slug, action] = pathSegments;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' });
  }

  // Route based on action and method
  switch (action) {
    case 'get':
      return handleGet(req, res, slug);
    case 'update':
      return handleUpdate(req, res, slug);
    case 'delete':
      return handleDelete(req, res, slug);
    default:
      return res.status(404).json({ error: `Unknown action: ${action}` });
  }
}

async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  slug: string
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

async function handleUpdate(
  req: VercelRequest,
  res: VercelResponse,
  slug: string
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    let index = await kv.get<SimulatorIndex>(KV_INDEX_KEY);

    // Initialize index if it doesn't exist (first simulator creation)
    if (!index) {
      index = {
        simulators: [],
        defaultSlug: '',
      };
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

    // Set default slug if this is the first simulator
    if (!updatedIndex.defaultSlug && updatedIndex.simulators.length > 0) {
      updatedIndex.defaultSlug = newSlug;
    }

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

async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  slug: string
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get current index
    const index = await kv.get<SimulatorIndex>(KV_INDEX_KEY);
    if (!index) {
      return res.status(500).json({ error: 'Simulator index not found' });
    }

    // Check if simulator exists
    const simulatorExists = index.simulators.some((s) => s.slug === slug);
    if (!simulatorExists) {
      return res.status(404).json({ error: 'Simulator not found' });
    }

    // Prevent deleting last simulator
    if (index.simulators.length <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last simulator' });
    }

    // Remove from index
    const updatedSimulators = index.simulators.filter((s) => s.slug !== slug);

    // Update default slug if we're deleting the default
    let newDefaultSlug = index.defaultSlug;
    if (index.defaultSlug === slug) {
      newDefaultSlug = updatedSimulators[0].slug;
    }

    const updatedIndex: SimulatorIndex = {
      simulators: updatedSimulators,
      defaultSlug: newDefaultSlug,
    };

    // Delete config and update index
    await kv.del(getKvKey(slug));
    await kv.set(KV_INDEX_KEY, updatedIndex);

    return res.status(200).json({
      success: true,
      deletedSlug: slug,
      newDefaultSlug: index.defaultSlug === slug ? newDefaultSlug : undefined,
    });
  } catch (error) {
    console.error('Error deleting simulator:', error);
    return res.status(500).json({ error: 'Failed to delete simulator' });
  }
}
