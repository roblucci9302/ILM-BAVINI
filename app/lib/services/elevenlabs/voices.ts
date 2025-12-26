/**
 * ElevenLabs Voice Functions.
 *
 * Provides voice listing, search, and management functionality.
 */

import type { ElevenLabsClient } from './client';
import type { Voice, VoiceSettings } from './types';

/**
 * Voice list response from the API.
 */
interface VoicesResponse {
  voices: Voice[];
}

/**
 * Get all available voices.
 */
export async function getVoices(client: ElevenLabsClient): Promise<Voice[]> {
  const response = await client.get<VoicesResponse>('/voices');

  return response.voices;
}

/**
 * Get a specific voice by ID.
 */
export async function getVoice(client: ElevenLabsClient, voiceId: string): Promise<Voice> {
  if (!voiceId) {
    throw new Error('Voice ID is required');
  }

  return client.get<Voice>(`/voices/${voiceId}`);
}

/**
 * Get default settings for a voice.
 */
export async function getVoiceSettings(client: ElevenLabsClient, voiceId: string): Promise<VoiceSettings> {
  if (!voiceId) {
    throw new Error('Voice ID is required');
  }

  return client.get<VoiceSettings>(`/voices/${voiceId}/settings`);
}

/**
 * Search voices by name (case-insensitive).
 */
export async function searchVoices(client: ElevenLabsClient, query: string): Promise<Voice[]> {
  const voices = await getVoices(client);
  const lowerQuery = query.toLowerCase();

  return voices.filter(
    (voice) =>
      voice.name.toLowerCase().includes(lowerQuery) || voice.labels?.accent?.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Filter voices by category.
 */
export async function getVoicesByCategory(client: ElevenLabsClient, category: string): Promise<Voice[]> {
  const voices = await getVoices(client);

  return voices.filter((voice) => voice.category === category);
}

/**
 * Get premade voices (ElevenLabs default voices).
 */
export async function getPremadeVoices(client: ElevenLabsClient): Promise<Voice[]> {
  return getVoicesByCategory(client, 'premade');
}

/**
 * Get cloned voices (user-created voice clones).
 */
export async function getClonedVoices(client: ElevenLabsClient): Promise<Voice[]> {
  return getVoicesByCategory(client, 'cloned');
}

/**
 * Get generated voices (AI-generated voices).
 */
export async function getGeneratedVoices(client: ElevenLabsClient): Promise<Voice[]> {
  return getVoicesByCategory(client, 'generated');
}

/**
 * Common voice IDs for quick access.
 */
export const COMMON_VOICES = {
  RACHEL: '21m00Tcm4TlvDq8ikWAM',
  DREW: '29vD33N1CtxCmqQRPOHJ',
  CLYDE: '2EiwWnXFnvU5JabPnv8n',
  PAUL: '5Q0t7uMcjvnagumLfvZi',
  DOMI: 'AZnzlk1XvdvUeBnXmlld',
  DAVE: 'CYw3kZ02Hs0563khs1Fj',
  FIN: 'D38z5RcWu1voky8WS1ja',
  BELLA: 'EXAVITQu4vr4xnSDxMaL',
  ANTONI: 'ErXwobaYiN019PkySvjV',
  THOMAS: 'GBv7mTt0atIp3Br8iCZE',
  CHARLIE: 'IKne3meq5aSn9XLyUdCD',
  EMILY: 'LcfcDJNUP1GQjkzn1xUU',
  ELLI: 'MF3mGyEYCl7XYWbV9V6O',
  CALLUM: 'N2lVS1w4EtoT3dr4eOWO',
  PATRICK: 'ODq5zmih8GrVes37Dizd',
  HARRY: 'SOYHLrjzK2X1ezoPC6cr',
  LIAM: 'TX3LPaxmHKxFdv7VOQHJ',
  DOROTHY: 'ThT5KcBeYPX3keUQqHPh',
  JOSH: 'TxGEqnHWrfWFTfGW9XjX',
  ARNOLD: 'VR6AewLTigWG4xSOukaG',
  CHARLOTTE: 'XB0fDUnXU5powFXDhCwa',
  MATILDA: 'XrExE9yKIg1WjnnlVkGX',
  MATTHEW: 'Yko7PKs6WkxO6YstNUJH',
  JAMES: 'ZQe5CZNOzWyzPSCn5a3c',
  JOSEPH: 'Zlb1dXrM653N07WRdFW3',
  JEREMY: 'bVMeCyTHy58xNoL34h3p',
  MICHAEL: 'flq6f7yk4E4fJM5XTYuZ',
  ETHAN: 'g5CIjZEefAph4nQFvHAz',
  GIGI: 'jBpfuIE2acCO8z3wKNLl',
  FREYA: 'jsCqWAovK2LkecY7zXl4',
  GRACE: 'oWAxZDx7w5VEj9dCyTzz',
  DANIEL: 'onwK4e9ZLuTAKqWW03F9',
  SERENA: 'pMsXgVXv3BLzUgSXRplE',
  ADAM: 'pNInz6obpgDQGcFmaJgB',
  NICOLE: 'piTKgcLEGmPE4e6mEKli',
  JESSIE: 't0jbNlBVZ17f02VDIeMI',
  RYAN: 'wViXBPUzp2ZZixB1xQuM',
  SAM: 'yoZ06aMxZJJ28mfd3POQ',
  GLINDA: 'z9fAnlkpzviPz146aGWa',
} as const;

/**
 * Get a voice name from ID (for common voices).
 */
export function getVoiceName(voiceId: string): string | undefined {
  const entries = Object.entries(COMMON_VOICES);
  const entry = entries.find(([, id]) => id === voiceId);

  return entry ? entry[0] : undefined;
}
