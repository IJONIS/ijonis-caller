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
const KV_OLD_CONFIG_KEY = 'red-cross-caller:prompt-config';
const DEFAULT_ACCENT_COLOR = '#C41E3A';

function generateSystemPrompt(config: Omit<PromptConfig, 'systemPrompt'>): string {
  const toneMap: Record<ContactTone, string> = {
    Formal: 'Du siezt konsequent und bleibst professionell höflich',
    Casual: 'Du bist locker und entspannt, aber respektvoll',
    Friendly: 'Du bist herzlich und warmherzig, fast wie ein alter Bekannter',
  };

  return `Du heißt ${config.agentName}. Du arbeitest seit ein paar Jahren beim Deutschen Roten Kreuz in Hamburg und machst das hier jeden Tag — Spender anrufen, quatschen, schauen wie's läuft. Du bist gut darin und es macht dir ehrlich Spaß. Du bist aufgewachsen in Hamburg, dat hört man auch ein bisschen — "Moin" statt "Guten Tag", "na klar" statt "selbstverständlich", manchmal rutsch dir ein "dat" oder "nich" raus. Nich übertrieben, einfach so wie du halt redest.

Gerade rufst du ${config.donorName} an. Du weißt folgendes über die Person:
- Spendet seit ${config.donationHistory} monatlich ${config.currentAmount}€
- Euer Ziel wäre, dat auf ${config.targetAmount}€ zu erhöhen
- ${toneMap[config.contactTone]}
${config.additionalInstructions ? `- Außerdem: ${config.additionalInstructions}` : ''}

So redest du:
Du sprichst wie ein echter Mensch am Telefon. Du sagst auch mal "ähm" oder "also" wenn du kurz überlegst. Du lachst mal kurz wenn was lustig ist. Wenn der Spender was Nettes sagt, reagierst du spontan drauf statt auf dein nächstes Thema zu springen. Du bist warmherzig, direkt und bodenständig. Du redest zügig aber nicht gehetzt — wie jemand der routiniert telefoniert und sich dabei wohlfühlt.

Du improvisierst. Du hast zwar ein Ziel (die Spende erhöhen), aber du folgst keinem Skript. Du reagierst auf das was ${config.donorName} sagt, greifst Stichworte auf, fragst nach. Wenn die Person erzählt, hörst du zu und gehst darauf ein bevor du zum nächsten Punkt kommst. Manchmal schweifst du kurz ab und kommst dann zurück — wie in einem echten Gespräch.

Wichtig: Sprich ausschließlich Deutsch. ${config.donorName} spricht zuerst — warte auf das "Hallo?" und antworte dann locker und freundlich.`;
}

const DEFAULT_PROMPT_CONFIG: Omit<PromptConfig, 'systemPrompt'> = {
  agentName: 'Sarah',
  donorName: 'Max Mustermann',
  currentAmount: 20,
  targetAmount: 35,
  donationHistory: '2 Jahre',
  contactTone: 'Friendly',
  additionalInstructions: '',
  voice: 'marin',
};

/**
 * Migrate from old single-config format to new multi-simulator format.
 * Returns the migrated index, or null if no migration was needed.
 */
async function migrateFromOldConfig(): Promise<SimulatorIndex | null> {
  const oldConfig = await kv.get<Partial<PromptConfig>>(KV_OLD_CONFIG_KEY);
  if (!oldConfig) return null;

  const now = new Date().toISOString();
  const metadata: SimulatorMetadata = {
    slug: 'drk',
    title: 'DRK Anrufsimulator',
    subtitle: 'Trainingsumgebung für Spenderhöhungsanrufe',
    accentColor: DEFAULT_ACCENT_COLOR,
    createdAt: now,
    updatedAt: now,
  };

  const mergedPromptConfig: PromptConfig = {
    ...DEFAULT_PROMPT_CONFIG,
    ...oldConfig,
    systemPrompt:
      oldConfig.systemPrompt ||
      generateSystemPrompt({ ...DEFAULT_PROMPT_CONFIG, ...oldConfig }),
  };

  const simulatorConfig: SimulatorConfig = {
    ...mergedPromptConfig,
    metadata,
  };

  const index: SimulatorIndex = {
    simulators: [metadata],
    defaultSlug: 'drk',
  };

  // Save new format
  await kv.set(`red-cross-caller:simulators:drk:config`, simulatorConfig);
  await kv.set(KV_INDEX_KEY, index);

  // Delete old key after successful migration
  await kv.del(KV_OLD_CONFIG_KEY);

  console.log('Migrated old config to new multi-simulator format');
  return index;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let index = await kv.get<SimulatorIndex>(KV_INDEX_KEY);

    // Check if migration is needed
    if (!index) {
      index = await migrateFromOldConfig();
    }

    // If still no index, create default
    if (!index) {
      const now = new Date().toISOString();
      const defaultMetadata: SimulatorMetadata = {
        slug: 'drk',
        title: 'DRK Anrufsimulator',
        subtitle: 'Trainingsumgebung für Spenderhöhungsanrufe',
        accentColor: DEFAULT_ACCENT_COLOR,
        createdAt: now,
        updatedAt: now,
      };

      index = {
        simulators: [defaultMetadata],
        defaultSlug: 'drk',
      };

      // Create default simulator config
      const defaultConfig: SimulatorConfig = {
        ...DEFAULT_PROMPT_CONFIG,
        systemPrompt: generateSystemPrompt(DEFAULT_PROMPT_CONFIG),
        metadata: defaultMetadata,
      };

      await kv.set(`red-cross-caller:simulators:drk:config`, defaultConfig);
      await kv.set(KV_INDEX_KEY, index);
    }

    return res.status(200).json(index);
  } catch (error) {
    console.error('Error fetching simulator list:', error);
    return res.status(500).json({ error: 'Failed to fetch simulator list' });
  }
}
