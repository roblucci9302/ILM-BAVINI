/**
 * ElevenLabs SDK.
 *
 * Provides text-to-speech and voice management functionality.
 */

// Client
export { ElevenLabsClient, createElevenLabsClient } from './client';

// Types
export type {
  ElevenLabsConfig,
  ElevenLabsError,
  ElevenLabsModel,
  OutputFormat,
  TTSOptions,
  Voice,
  VoiceSettings,
  VoiceLabels,
  User,
  Subscription,
} from './types';

export { DEFAULT_VOICE_SETTINGS, ELEVENLABS_MODELS, OUTPUT_FORMATS } from './types';

// TTS functions
export {
  textToSpeech,
  textToSpeechStream,
  textToSpeechLong,
  audioBufferToBlob,
  createAudioUrl,
  playAudio,
  estimateCharacterCount,
  splitTextIntoChunks,
  concatenateAudioBuffers,
  DEFAULT_MODEL,
  DEFAULT_OUTPUT_FORMAT,
} from './tts';

// Voice functions
export {
  getVoices,
  getVoice,
  getVoiceSettings,
  searchVoices,
  getVoicesByCategory,
  getPremadeVoices,
  getClonedVoices,
  getGeneratedVoices,
  getVoiceName,
  COMMON_VOICES,
} from './voices';
