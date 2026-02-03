export enum CallState {
  IDLE = 'IDLE',
  RINGING = 'RINGING',
  CONNECTING = 'CONNECTING',
  USER_SPEAKING = 'USER_SPEAKING',
  AGENT_SPEAKING = 'AGENT_SPEAKING',
  CONVERSATION = 'CONVERSATION',
  ENDED = 'ENDED',
}

export type ContactTone = 'Formal' | 'Casual' | 'Friendly';

/**
 * Available OpenAI Realtime API voices.
 * Premium voices (marin, cedar) are recommended for best quality.
 */
export type RealtimeVoice =
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

export const REALTIME_VOICES: { value: RealtimeVoice; label: string; premium?: boolean }[] = [
  { value: 'marin', label: 'Marin', premium: true },
  { value: 'cedar', label: 'Cedar', premium: true },
  { value: 'alloy', label: 'Alloy' },
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'echo', label: 'Echo' },
  { value: 'sage', label: 'Sage' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'verse', label: 'Verse' },
];

export interface PromptConfig {
  agentName: string;
  donorName: string;
  currentAmount: number;
  targetAmount: number;
  donationHistory: string;
  contactTone: ContactTone;
  additionalInstructions?: string;
  /** OpenAI Realtime voice to use for the agent */
  voice: RealtimeVoice;
  // The actual prompt text - can be auto-generated or manually edited
  systemPrompt: string;
}

export function generateSystemPrompt(config: Omit<PromptConfig, 'systemPrompt'>): string {
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

export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
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

// Initialize the default prompt
DEFAULT_PROMPT_CONFIG.systemPrompt = generateSystemPrompt(DEFAULT_PROMPT_CONFIG);

// ============================================================================
// Multi-Simulator Types
// ============================================================================

/**
 * Simulator metadata displayed in UI and used for routing.
 */
export interface SimulatorMetadata {
  /** URL path segment: "demo", "training-1", etc. */
  slug: string;
  /** Display title: "Ijonis Anrufsimulator" */
  title: string;
  /** Display subtitle: "Trainingsumgebung für Spenderhöhungsanrufe" */
  subtitle: string;
  /** Hex color code for accent UI elements: "#C41E3A" */
  accentColor: string;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Full simulator configuration combining metadata with prompt config.
 */
export interface SimulatorConfig extends PromptConfig {
  metadata: SimulatorMetadata;
}

/**
 * Index of all simulators stored in KV.
 */
export interface SimulatorIndex {
  simulators: SimulatorMetadata[];
  /** Which simulator "/" redirects to */
  defaultSlug: string;
}

/**
 * Default accent color.
 */
export const DEFAULT_ACCENT_COLOR = '#C41E3A';

/**
 * Default simulator metadata.
 */
export const DEFAULT_SIMULATOR_METADATA: SimulatorMetadata = {
  slug: 'demo',
  title: 'Ijonis Anrufsimulator',
  subtitle: 'Trainingsumgebung für Spenderhöhungsanrufe',
  accentColor: DEFAULT_ACCENT_COLOR,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Default simulator config combining prompt config with metadata.
 */
export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = {
  ...DEFAULT_PROMPT_CONFIG,
  metadata: DEFAULT_SIMULATOR_METADATA,
};

/**
 * Validates a hex color code.
 * @param color - Color string to validate
 * @returns true if valid hex color (3 or 6 digits with #)
 */
export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

/**
 * Validates a slug for URL safety.
 * @param slug - Slug string to validate
 * @returns true if valid (lowercase alphanumeric with hyphens, 1-50 chars)
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/.test(slug) || /^[a-z0-9]$/.test(slug);
}

/**
 * Sanitizes a string into a valid slug.
 * @param input - String to convert to slug
 * @returns URL-safe slug
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[char] || char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
