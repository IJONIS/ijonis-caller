import { useEffect, useRef, useMemo } from 'react';
import { DEFAULT_ACCENT_COLOR } from '../types';

interface RingingPhoneProps {
  onAnswer: () => void;
  onDecline: () => void;
  accentColor?: string;
}

/**
 * Generate a darker shade of a hex color for gradient effects.
 */
function darkenHex(hex: string, percent: number = 15): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(2.55 * percent));
  const b = Math.max(0, (num & 0x0000ff) - Math.round(2.55 * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default function RingingPhone({ onAnswer, onDecline, accentColor = DEFAULT_ACCENT_COLOR }: RingingPhoneProps) {
  const accentColorDark = useMemo(() => darkenHex(accentColor), [accentColor]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for ringing sound
    audioRef.current = new Audio('/sounds/phone-ring.wav');
    audioRef.current.loop = true;
    audioRef.current.play().catch(err => {
      console.warn('Could not play ring sound:', err);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleAnswer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onAnswer();
  };

  const handleDecline = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onDecline();
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8 border border-gray-100">
      {/* Ringing Icon */}
      <div className="relative flex justify-center h-32">
        <div className="absolute w-32 h-32 bg-green-400 rounded-full opacity-20 animate-ripple" />
        <div className="absolute w-32 h-32 bg-green-400 rounded-full opacity-20 animate-ripple" style={{ animationDelay: '0.5s' }} />
        <div className="absolute w-32 h-32 bg-green-400 rounded-full opacity-10 animate-ripple" style={{ animationDelay: '1s' }} />
        <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-xl animate-pulse-ring">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold text-gray-900">Eingehender Anruf</h2>
        <p className="text-gray-600 font-medium">Deutsches Rotes Kreuz</p>
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Trainingsszenario</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={handleDecline}
          className="group relative hover:shadow-lg text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2"
          style={{ background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})` }}
        >
          <svg className="w-5 h-5 rotate-135" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
          <span>Ablehnen</span>
        </button>
        <button
          onClick={handleAnswer}
          className="group relative bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
          <span>Annehmen</span>
        </button>
      </div>

      <p className="text-xs text-center text-gray-500 pt-2">
        Nehmen Sie den Anruf an, um mit dem Training zu beginnen
      </p>
    </div>
  );
}
