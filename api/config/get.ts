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

function generateSystemPrompt(
  config: Omit<PromptConfig, 'systemPrompt'>
): string {
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
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const storedConfig = await kv.get<Partial<PromptConfig>>(
      'ijonis-caller:prompt-config'
    );

    // Merge stored config with defaults
    const config: PromptConfig = {
      ...DEFAULT_PROMPT_CONFIG,
      ...storedConfig,
      systemPrompt: '',
    };

    // Generate system prompt if missing or empty
    if (!storedConfig?.systemPrompt || storedConfig.systemPrompt.trim() === '') {
      config.systemPrompt = generateSystemPrompt(config);
    } else {
      config.systemPrompt = storedConfig.systemPrompt;
    }

    return res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    return res.status(500).json({ error: 'Failed to fetch configuration' });
  }
}
