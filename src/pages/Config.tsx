import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  SimulatorConfig,
  SimulatorIndex,
  SimulatorMetadata,
  ContactTone,
  RealtimeVoice,
  Persona,
} from '../types';
import {
  DEFAULT_SIMULATOR_CONFIG,
  DEFAULT_ACCENT_COLOR,
  generateSystemPrompt,
  REALTIME_VOICES,
  isValidHexColor,
  isValidSlug,
  toSlug,
  SPEECH_SPEED_MIN,
  SPEECH_SPEED_MAX,
  SPEECH_SPEED_DEFAULT,
  SPEECH_SPEED_STEP,
  MAX_PERSONAS,
} from '../types';

export default function Config() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [simulators, setSimulators] = useState<SimulatorMetadata[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>('');
  const [config, setConfig] = useState<SimulatorConfig | null>(null);
  const [originalSlug, setOriginalSlug] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [promptManuallyEdited, setPromptManuallyEdited] = useState(false);
  const [isNewSimulator, setIsNewSimulator] = useState(false);

  // Fetch simulator list on mount
  useEffect(() => {
    fetchSimulatorList();
  }, []);

  // Load simulator config when activeSlug changes
  useEffect(() => {
    if (activeSlug && !isNewSimulator) {
      fetchSimulatorConfig(activeSlug);
    }
  }, [activeSlug, isNewSimulator]);

  const fetchSimulatorList = async () => {
    try {
      const response = await fetch('/api/simulators/list');
      const data: SimulatorIndex = await response.json();
      setSimulators(data.simulators);

      // Check for ?simulator= query param
      const querySlug = searchParams.get('simulator');
      if (querySlug && data.simulators.some((s) => s.slug === querySlug)) {
        setActiveSlug(querySlug);
      } else if (data.simulators.length > 0) {
        setActiveSlug(data.simulators[0].slug);
      }
    } catch (error) {
      console.error('Error fetching simulator list:', error);
      setMessage('Fehler beim Laden der Simulatoren');
    } finally {
      setLoading(false);
    }
  };

  const fetchSimulatorConfig = async (slug: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/simulators/${encodeURIComponent(slug)}/get`);
      if (!response.ok) {
        throw new Error('Simulator nicht gefunden');
      }
      const data: SimulatorConfig = await response.json();
      setConfig(data);
      setOriginalSlug(slug);
      setPromptManuallyEdited(false);
    } catch (error) {
      console.error('Error fetching simulator config:', error);
      setMessage('Fehler beim Laden der Konfiguration');
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (slug: string) => {
    if (slug === activeSlug) return;
    setIsNewSimulator(false);
    setActiveSlug(slug);
    setMessage('');
    setSearchParams({ simulator: slug });
  };

  const handleNewSimulator = () => {
    const now = new Date().toISOString();
    const newConfig: SimulatorConfig = {
      ...DEFAULT_SIMULATOR_CONFIG,
      metadata: {
        slug: '',
        title: '',
        subtitle: '',
        accentColor: DEFAULT_ACCENT_COLOR,
        createdAt: now,
        updatedAt: now,
      },
      systemPrompt: generateSystemPrompt(DEFAULT_SIMULATOR_CONFIG),
    };
    setConfig(newConfig);
    setOriginalSlug('');
    setIsNewSimulator(true);
    setActiveSlug('__new__');
    setMessage('');
    setPromptManuallyEdited(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    // Validate slug
    if (!config.metadata.slug || !isValidSlug(config.metadata.slug)) {
      setMessage('Fehler: Ungültiger Slug (nur Kleinbuchstaben, Zahlen und Bindestriche)');
      return;
    }

    // Validate title
    if (!config.metadata.title.trim()) {
      setMessage('Fehler: Titel ist erforderlich');
      return;
    }

    // Validate accent color
    if (!isValidHexColor(config.metadata.accentColor)) {
      setMessage('Fehler: Ungültige Akzentfarbe (Format: #RRGGBB)');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const endpoint = isNewSimulator
        ? `/api/simulators/${encodeURIComponent(config.metadata.slug)}/update`
        : `/api/simulators/${encodeURIComponent(originalSlug)}/update`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Konfiguration erfolgreich gespeichert ✓');

        // Refresh simulator list
        await fetchSimulatorList();

        // Update state for slug changes
        if (data.slugChanged || isNewSimulator) {
          setActiveSlug(config.metadata.slug);
          setOriginalSlug(config.metadata.slug);
          setSearchParams({ simulator: config.metadata.slug });
        }
        setIsNewSimulator(false);
      } else {
        setMessage(`Fehler: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage('Fehler beim Speichern der Konfiguration');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!config || isNewSimulator) return;
    if (simulators.length <= 1) {
      setMessage('Der letzte Simulator kann nicht gelöscht werden');
      return;
    }

    const confirmed = window.confirm(
      `Simulator "${config.metadata.title}" wirklich löschen?`
    );
    if (!confirmed) return;

    setDeleting(true);
    setMessage('');

    try {
      const response = await fetch(
        `/api/simulators/${encodeURIComponent(originalSlug)}/delete`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage('Simulator gelöscht ✓');
        // Refresh list and select first remaining
        await fetchSimulatorList();
      } else {
        setMessage(`Fehler: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting simulator:', error);
      setMessage('Fehler beim Löschen des Simulators');
    } finally {
      setDeleting(false);
    }
  };

  const updateField = <K extends keyof SimulatorConfig>(
    key: K,
    value: SimulatorConfig[K]
  ) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [key]: value };
      // Auto-regenerate prompt if not manually edited
      if (key !== 'systemPrompt' && key !== 'metadata' && !promptManuallyEdited) {
        updated.systemPrompt = generateSystemPrompt(updated);
      }
      return updated;
    });
  };

  const updateMetadata = <K extends keyof SimulatorMetadata>(
    key: K,
    value: SimulatorMetadata[K]
  ) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          [key]: value,
        },
      };
    });
  };

  const handlePromptChange = (value: string) => {
    setPromptManuallyEdited(true);
    setConfig((prev) => (prev ? { ...prev, systemPrompt: value } : prev));
  };

  const regeneratePrompt = () => {
    setPromptManuallyEdited(false);
    setConfig((prev) => (prev ? { ...prev, systemPrompt: generateSystemPrompt(prev) } : prev));
  };

  const updatePersona = (index: number, field: keyof Persona, value: Persona[keyof Persona]) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const personas = [...(prev.personas || [])];
      // Ensure array has enough slots
      while (personas.length <= index) {
        personas.push({ name: '', prompt: '' });
      }
      personas[index] = { ...personas[index], [field]: value };
      return { ...prev, personas };
    });
  };

  if (loading && simulators.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Simulator-Konfiguration</h1>
          <a
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            <span>Zurück zum Simulator</span>
          </a>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-4 overflow-x-auto">
            {simulators.map((sim) => (
              <button
                key={sim.slug}
                onClick={() => handleTabClick(sim.slug)}
                className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                  activeSlug === sim.slug
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {sim.title || sim.slug}
              </button>
            ))}
            <button
              onClick={handleNewSimulator}
              className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeSlug === '__new__'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              + Neu
            </button>
          </nav>
        </div>

        {/* Form */}
        {config && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Simulator Settings */}
            <Section title="Simulator-Einstellungen">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Slug *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. drk-training"
                    value={config.metadata.slug}
                    onChange={(e) => updateMetadata('slug', toSlug(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    URL: /{config.metadata.slug || 'slug'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Akzentfarbe *
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <input
                      type="text"
                      required
                      placeholder="#C41E3A"
                      value={config.metadata.accentColor}
                      onChange={(e) => updateMetadata('accentColor', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                    />
                    <div
                      className="w-10 h-10 rounded-md border border-gray-300 shrink-0"
                      style={{
                        backgroundColor: isValidHexColor(config.metadata.accentColor)
                          ? config.metadata.accentColor
                          : '#ccc',
                      }}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Titel *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Ijonis Anrufsimulator"
                    value={config.metadata.title}
                    onChange={(e) => updateMetadata('title', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Untertitel
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. Trainingsumgebung für Spenderhöhungsanrufe"
                    value={config.metadata.subtitle}
                    onChange={(e) => updateMetadata('subtitle', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>
              </div>
            </Section>

            {/* Agent Settings */}
            <Section title="Agent-Einstellungen">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={config.agentName}
                    onChange={(e) => updateField('agentName', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Kontaktton *
                  </label>
                  <select
                    required
                    value={config.contactTone}
                    onChange={(e) => updateField('contactTone', e.target.value as ContactTone)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  >
                    <option value="Formal">Formal (Sie)</option>
                    <option value="Casual">Casual (locker)</option>
                    <option value="Friendly">Freundlich (herzlich)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Stimme *
                  </label>
                  <select
                    required
                    value={config.voice}
                    onChange={(e) => updateField('voice', e.target.value as RealtimeVoice)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  >
                    {REALTIME_VOICES.map((voice) => (
                      <option key={voice.value} value={voice.value}>
                        {voice.label}
                        {voice.premium ? ' ⭐ (Premium)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Premium-Stimmen (Marin, Cedar) bieten die beste Audioqualität.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Sprechgeschwindigkeit
                  </label>
                  <div className="mt-1 flex items-center space-x-4">
                    <input
                      type="range"
                      min={SPEECH_SPEED_MIN}
                      max={SPEECH_SPEED_MAX}
                      step={SPEECH_SPEED_STEP}
                      value={config.speechSpeed ?? SPEECH_SPEED_DEFAULT}
                      onChange={(e) => updateField('speechSpeed', Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="w-16 text-center text-sm font-medium text-gray-700">
                      {(config.speechSpeed ?? SPEECH_SPEED_DEFAULT).toFixed(2)}x
                    </span>
                    <button
                      type="button"
                      onClick={() => updateField('speechSpeed', SPEECH_SPEED_DEFAULT)}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Zurücksetzen
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {SPEECH_SPEED_MIN}x (langsam) bis {SPEECH_SPEED_MAX}x (schnell), Standard: {SPEECH_SPEED_DEFAULT}x
                  </p>
                </div>
              </div>
            </Section>

            {/* Donor Information */}
            <Section title="Spender-Informationen">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Spender Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={config.donorName}
                    onChange={(e) => updateField('donorName', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Spendenhistorie *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. 2 Jahre"
                    value={config.donationHistory}
                    onChange={(e) => updateField('donationHistory', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Aktueller Betrag (€) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={config.currentAmount}
                    onChange={(e) => updateField('currentAmount', Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Ziel-Betrag (€) *
                  </label>
                  <input
                    type="number"
                    required
                    min={config.currentAmount + 1}
                    value={config.targetAmount}
                    onChange={(e) => updateField('targetAmount', Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Zusätzliche Anweisungen
                </label>
                <textarea
                  rows={2}
                  value={config.additionalInstructions}
                  onChange={(e) => updateField('additionalInstructions', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                  placeholder="Spezielle Taktiken oder Hinweise für den Agent..."
                />
              </div>
            </Section>

            {/* Personas */}
            <Section title="Personas">
              <p className="text-sm text-gray-500 mb-4">
                Bis zu {MAX_PERSONAS} Personas konfigurieren. Konfigurierte Personas erscheinen als Dropdown auf dem Anrufbildschirm. Leere Felder werden ignoriert.
              </p>
              <div className="space-y-4">
                {Array.from({ length: MAX_PERSONAS }, (_, i) => {
                  const persona = config.personas?.[i] || { name: '', prompt: '' };
                  return (
                    <div key={i} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          Persona {i + 1}
                        </span>
                        {persona.name.trim() && persona.prompt.trim() && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            Aktiv
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-gray-600">Name</label>
                          <input
                            type="text"
                            placeholder={`z.B. Persona ${i + 1}`}
                            value={persona.name}
                            onChange={(e) => updatePersona(i, 'name', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Prompt</label>
                          <textarea
                            rows={3}
                            placeholder="Zusätzliche Anweisungen für diese Persona..."
                            value={persona.prompt}
                            onChange={(e) => updatePersona(i, 'prompt', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-600">
                              Stimme
                              <span className="text-gray-400 ml-1">(optional)</span>
                            </label>
                            <select
                              value={persona.voice || ''}
                              onChange={(e) =>
                                updatePersona(
                                  i,
                                  'voice',
                                  e.target.value ? (e.target.value as RealtimeVoice) : undefined
                                )
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 text-sm"
                            >
                              <option value="">Standard ({config.voice})</option>
                              {REALTIME_VOICES.map((v) => (
                                <option key={v.value} value={v.value}>
                                  {v.label}{v.premium ? ' ⭐' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600">
                              Geschwindigkeit
                              <span className="text-gray-400 ml-1">(optional)</span>
                            </label>
                            <div className="mt-1 flex items-center space-x-2">
                              <input
                                type="range"
                                min={SPEECH_SPEED_MIN}
                                max={SPEECH_SPEED_MAX}
                                step={SPEECH_SPEED_STEP}
                                value={persona.speechSpeed ?? config.speechSpeed ?? SPEECH_SPEED_DEFAULT}
                                onChange={(e) => updatePersona(i, 'speechSpeed', Number(e.target.value))}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="w-12 text-center text-xs font-medium text-gray-600">
                                {persona.speechSpeed != null
                                  ? `${persona.speechSpeed.toFixed(2)}x`
                                  : 'Std.'}
                              </span>
                              {persona.speechSpeed != null && (
                                <button
                                  type="button"
                                  onClick={() => updatePersona(i, 'speechSpeed', undefined)}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                  title="Zurücksetzen auf Standard"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* System Prompt */}
            <Section title="System Prompt">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-500">
                  Der vollständige Prompt wird aus den obigen Feldern generiert.
                </p>
                <button
                  type="button"
                  onClick={regeneratePrompt}
                  className="text-sm text-gray-700 hover:text-gray-900 underline"
                >
                  Neu generieren
                </button>
              </div>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                rows={16}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 font-mono text-sm leading-relaxed"
              />
              {promptManuallyEdited && (
                <p className="mt-1 text-xs text-amber-600">
                  Prompt wurde manuell bearbeitet. Änderungen an den Feldern oben werden nicht automatisch übernommen.
                </p>
              )}
            </Section>

            {/* Actions */}
            <div className="flex items-center justify-between space-x-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gray-900 text-white py-3 px-4 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Speichert...' : isNewSimulator ? 'Simulator erstellen' : 'Speichern'}
              </button>
              {!isNewSimulator && simulators.length > 1 && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-3 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Löscht...' : 'Löschen'}
                </button>
              )}
            </div>

            {/* Success/Error Message */}
            {message && (
              <div
                className={`p-4 rounded-md ${
                  message.includes('✓')
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {message}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}
