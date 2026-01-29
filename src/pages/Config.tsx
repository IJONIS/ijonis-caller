import React, { useState, useEffect } from 'react';
import type { PromptConfig, ContactTone } from '../types';

export default function Config() {
  const [config, setConfig] = useState<PromptConfig>({
    agentName: '',
    donorName: '',
    currentAmount: 0,
    targetAmount: 0,
    donationHistory: '',
    contactTone: 'Friendly',
    additionalInstructions: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config/get');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
      setMessage('Fehler beim Laden der Konfiguration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/config/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Konfiguration erfolgreich gespeichert ✓');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Anruf-Konfiguration
        </h1>

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-6">
          {/* Agent Settings */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent-Einstellungen</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="agentName" className="block text-sm font-medium text-gray-700">
                  Agent Name *
                </label>
                <input
                  type="text"
                  id="agentName"
                  required
                  value={config.agentName}
                  onChange={(e) => setConfig({ ...config, agentName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                />
              </div>

              <div>
                <label htmlFor="contactTone" className="block text-sm font-medium text-gray-700">
                  Kontaktton *
                </label>
                <select
                  id="contactTone"
                  required
                  value={config.contactTone}
                  onChange={(e) => setConfig({ ...config, contactTone: e.target.value as ContactTone })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                >
                  <option value="Formal">Formal</option>
                  <option value="Casual">Casual</option>
                  <option value="Friendly">Friendly</option>
                </select>
              </div>
            </div>
          </div>

          {/* Donor Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Spender-Informationen</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="donorName" className="block text-sm font-medium text-gray-700">
                  Spender Name *
                </label>
                <input
                  type="text"
                  id="donorName"
                  required
                  value={config.donorName}
                  onChange={(e) => setConfig({ ...config, donorName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="currentAmount" className="block text-sm font-medium text-gray-700">
                    Aktueller Betrag (€) *
                  </label>
                  <input
                    type="number"
                    id="currentAmount"
                    required
                    min="1"
                    value={config.currentAmount}
                    onChange={(e) => setConfig({ ...config, currentAmount: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                  />
                </div>

                <div>
                  <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700">
                    Ziel-Betrag (€) *
                  </label>
                  <input
                    type="number"
                    id="targetAmount"
                    required
                    min={config.currentAmount + 1}
                    value={config.targetAmount}
                    onChange={(e) => setConfig({ ...config, targetAmount: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="donationHistory" className="block text-sm font-medium text-gray-700">
                  Spendenhistorie *
                </label>
                <input
                  type="text"
                  id="donationHistory"
                  required
                  placeholder="z.B. 2 Jahre"
                  value={config.donationHistory}
                  onChange={(e) => setConfig({ ...config, donationHistory: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
                />
              </div>
            </div>
          </div>

          {/* Additional Instructions */}
          <div>
            <label htmlFor="additionalInstructions" className="block text-sm font-medium text-gray-700">
              Zusätzliche Anweisungen
            </label>
            <textarea
              id="additionalInstructions"
              rows={4}
              value={config.additionalInstructions}
              onChange={(e) => setConfig({ ...config, additionalInstructions: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-redcross focus:ring-redcross"
              placeholder="Spezielle Taktiken oder Hinweise für den Agent..."
            />
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-redcross text-white py-3 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-redcross focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Speichert...' : 'Konfiguration speichern'}
            </button>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`p-4 rounded-md ${message.includes('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
