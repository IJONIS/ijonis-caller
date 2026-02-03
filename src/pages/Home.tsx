import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SimulatorIndex } from '../types';

/**
 * Home page that redirects to the default simulator.
 * Fetches the simulator index to determine which slug to redirect to.
 */
export default function Home() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchDefaultSimulator = async () => {
      try {
        const response = await fetch('/api/simulators/list');
        if (!response.ok) {
          throw new Error('Konnte Simulatoren nicht laden');
        }
        const index: SimulatorIndex = await response.json();

        if (index.defaultSlug) {
          navigate(`/${index.defaultSlug}`, { replace: true });
        } else if (index.simulators.length > 0) {
          navigate(`/${index.simulators[0].slug}`, { replace: true });
        } else {
          setError('Keine Simulatoren konfiguriert');
        }
      } catch (err) {
        console.error('Error fetching simulator list:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      }
    };

    fetchDefaultSimulator();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center bg-white rounded-2xl shadow-xl p-10 border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Fehler</h2>
          <p className="text-gray-600">{error}</p>
          <a
            href="/config"
            className="inline-block mt-6 px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
          >
            Zu den Einstellungen
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-gray-600 rounded-full mx-auto mb-4" />
        <p className="text-gray-600">Lade Simulator...</p>
      </div>
    </div>
  );
}
