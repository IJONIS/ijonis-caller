import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

const KV_INDEX_KEY = 'ijonis-caller:simulators:index';

function getKvKey(slug: string): string {
  return `ijonis-caller:simulators:${slug}:config`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = req.query.slug;
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' });
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
