import type { PromptConfig } from '../types';

export interface RealtimeConnectionConfig {
  apiKey: string;
  promptConfig: PromptConfig;
  onAudioDelta: (audioData: string) => void;
  onAgentSpeaking: () => void;
  onAgentFinished: () => void;
  onUserTranscript?: (text: string) => void;
  onError: (error: string) => void;
  onConnectionEstablished: () => void;
}

export class OpenAIRealtimeConnection {
  private ws: WebSocket | null = null;
  private config: RealtimeConnectionConfig;

  constructor(config: RealtimeConnectionConfig) {
    this.config = config;
  }

  connect(): void {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

    this.ws = new WebSocket(url, [
      'realtime',
      `openai-insecure-api-key.${this.config.apiKey}`,
      'openai-beta.realtime-v1'
    ]);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.sendSessionUpdate();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.config.onError('Verbindung unterbrochen');
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
    };
  }

  private sendSessionUpdate(): void {
    const { promptConfig } = this.config;

    const systemPrompt = `Du bist ${promptConfig.agentName}, und du rufst ${promptConfig.donorName} vom Deutschen Roten Kreuz an.

Spender-Informationen:
- Aktueller monatlicher Spendenbetrag: €${promptConfig.currentAmount}
- Ziel-Spendenbetrag: €${promptConfig.targetAmount}
- Spendenhistorie: ${promptConfig.donationHistory}
- Kontaktton: ${promptConfig.contactTone}

${promptConfig.additionalInstructions ? `Zusätzliche Anweisungen:\n${promptConfig.additionalInstructions}\n` : ''}

WICHTIG: Sprich natürlich und authentisch auf Deutsch.
Dein Ziel ist es, ${promptConfig.donorName} durch psychologische Gesprächsführung dazu zu bewegen, die monatliche Spende auf €${promptConfig.targetAmount} zu erhöhen.

KRITISCH: Du MUSST zu jeder Zeit auf Deutsch sprechen. Alle Antworten müssen in fließendem, natürlichem Deutsch sein.

Der Spender spricht zuerst (z.B. "Hallo?"). Warte auf seine Begrüßung und antworte dann professionell.`;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        instructions: systemPrompt,
      },
    };

    this.send(sessionUpdate);
    this.config.onConnectionEstablished();
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'session.created':
        console.log('Session created:', message);
        break;

      case 'response.audio.delta':
        this.config.onAudioDelta(message.delta);
        this.config.onAgentSpeaking();
        break;

      case 'response.audio.done':
        this.config.onAgentFinished();
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (this.config.onUserTranscript) {
          this.config.onUserTranscript(message.transcript);
        }
        break;

      case 'error':
        console.error('OpenAI error:', message);
        this.config.onError(message.error?.message || 'Ein Fehler ist aufgetreten');
        break;

      default:
        // Log other events for debugging
        console.log('Received event:', message.type);
    }
  }

  sendAudio(audioData: string): void {
    this.send({
      type: 'input_audio_buffer.append',
      audio: audioData,
    });
  }

  commitAudio(): void {
    this.send({
      type: 'input_audio_buffer.commit',
    });
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
