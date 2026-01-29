import React, { useState, useRef, useEffect } from 'react';
import { CallState, type PromptConfig } from '../types';
import { OpenAIRealtimeConnection } from '../lib/openai-realtime';
import { AudioProcessor } from '../lib/audio-processor';
import PhoneVisualization from './PhoneVisualization';
import RingingPhone from './RingingPhone';

export default function CallInterface() {
  const [callState, setCallState] = useState<CallState>(CallState.IDLE);
  const [error, setError] = useState<string>('');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  const connectionRef = useRef<OpenAIRealtimeConnection | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }
    if (audioProcessorRef.current) {
      audioProcessorRef.current.cleanup();
      audioProcessorRef.current = null;
    }
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
  };

  const startCall = () => {
    setCallState(CallState.RINGING);
    setError('');
  };

  const answerCall = async () => {
    setCallState(CallState.CONNECTING);

    try {
      // Fetch configuration
      const configResponse = await fetch('/api/config/get');
      const promptConfig: PromptConfig = await configResponse.json();

      // Initialize audio processor
      audioProcessorRef.current = new AudioProcessor();
      await audioProcessorRef.current.requestMicrophoneAccess();

      // Get API key from environment
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Initialize WebSocket connection
      connectionRef.current = new OpenAIRealtimeConnection({
        apiKey,
        promptConfig,
        onAudioDelta: (audioData) => {
          audioProcessorRef.current?.playAudioDelta(audioData);
        },
        onAgentSpeaking: () => {
          setIsAgentSpeaking(true);
          setCallState(CallState.AGENT_SPEAKING);

          // Clear existing timeout
          if (speakingTimeoutRef.current) {
            clearTimeout(speakingTimeoutRef.current);
          }

          // Set timeout to return to conversation state
          speakingTimeoutRef.current = setTimeout(() => {
            setIsAgentSpeaking(false);
            setCallState(CallState.CONVERSATION);
          }, 500);
        },
        onAgentFinished: () => {
          setIsAgentSpeaking(false);
          setCallState(CallState.CONVERSATION);
        },
        onError: (errorMessage) => {
          setError(errorMessage);
          endCall();
        },
        onConnectionEstablished: () => {
          setCallState(CallState.USER_SPEAKING);

          // Start capturing audio
          audioProcessorRef.current?.startCapture((audioData) => {
            connectionRef.current?.sendAudio(audioData);
          });
        },
      });

      connectionRef.current.connect();
    } catch (err) {
      console.error('Error starting call:', err);
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen');
      setCallState(CallState.IDLE);
    }
  };

  const declineCall = () => {
    setCallState(CallState.IDLE);
  };

  const endCall = () => {
    cleanup();
    setCallState(CallState.ENDED);

    // Return to IDLE after brief delay
    setTimeout(() => {
      setCallState(CallState.IDLE);
      setError('');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-center">{error}</p>
            <button
              onClick={() => setError('')}
              className="mt-2 w-full text-red-600 hover:text-red-800 text-sm"
            >
              Schließen
            </button>
          </div>
        )}

        {/* IDLE State */}
        {callState === CallState.IDLE && (
          <div className="text-center space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                DRK Anrufsimulator
              </h1>
              <p className="text-gray-600">
                Starten Sie einen simulierten Anruf
              </p>
            </div>

            <button
              onClick={startCall}
              className="w-full max-w-xs mx-auto block bg-redcross text-white py-4 px-8 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-redcross focus:ring-offset-2 transition-colors text-lg font-semibold shadow-lg"
            >
              Anruf starten
            </button>
          </div>
        )}

        {/* RINGING State */}
        {callState === CallState.RINGING && (
          <RingingPhone onAnswer={answerCall} onDecline={declineCall} />
        )}

        {/* CONNECTING State */}
        {callState === CallState.CONNECTING && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-redcross mb-4" />
            <p className="text-gray-600">Verbinden...</p>
          </div>
        )}

        {/* ACTIVE CALL States (USER_SPEAKING, AGENT_SPEAKING, CONVERSATION) */}
        {(callState === CallState.USER_SPEAKING ||
          callState === CallState.AGENT_SPEAKING ||
          callState === CallState.CONVERSATION) && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-xl font-semibold text-center text-gray-900 mb-6">
                Anruf läuft
              </h2>

              <PhoneVisualization isSpeaking={isAgentSpeaking} />
            </div>

            <button
              onClick={endCall}
              className="w-full bg-redcross text-white py-4 px-8 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-redcross focus:ring-offset-2 transition-colors font-semibold shadow-lg"
            >
              Anruf beenden
            </button>
          </div>
        )}

        {/* ENDED State */}
        {callState === CallState.ENDED && (
          <div className="text-center space-y-4">
            <div className="text-6xl">📞</div>
            <h2 className="text-2xl font-bold text-gray-900">Anruf beendet</h2>
            <p className="text-gray-600">Kehre zum Startbildschirm zurück...</p>
          </div>
        )}
      </div>
    </div>
  );
}
