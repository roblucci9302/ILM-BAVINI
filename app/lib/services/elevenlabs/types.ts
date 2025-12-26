/**
 * ElevenLabs API Types.
 *
 * Type definitions for the ElevenLabs text-to-speech API.
 */

/**
 * ElevenLabs API configuration.
 */
export interface ElevenLabsConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Available TTS models.
 */
export type ElevenLabsModel =
  | 'eleven_multilingual_v2'
  | 'eleven_turbo_v2_5'
  | 'eleven_turbo_v2'
  | 'eleven_monolingual_v1'
  | 'eleven_multilingual_v1'
  | 'eleven_flash_v2_5'
  | 'eleven_flash_v2';

/**
 * Audio output formats.
 */
export type OutputFormat =
  | 'mp3_44100_128'
  | 'mp3_44100_192'
  | 'pcm_16000'
  | 'pcm_22050'
  | 'pcm_24000'
  | 'pcm_44100'
  | 'ulaw_8000';

/**
 * Voice settings for TTS.
 */
export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

/**
 * Text-to-speech options.
 */
export interface TTSOptions {
  text: string;
  voiceId: string;
  modelId?: ElevenLabsModel;
  voiceSettings?: VoiceSettings;
  outputFormat?: OutputFormat;
  optimizeStreamingLatency?: number;
}

/**
 * Voice labels for categorization.
 */
export interface VoiceLabels {
  accent?: string;
  description?: string;
  age?: string;
  gender?: string;
  use_case?: string;
}

/**
 * Voice fine-tuning information.
 */
export interface VoiceFineTuning {
  is_allowed_to_fine_tune: boolean;
  language?: string;
  finetuning_state?: string;
}

/**
 * Voice information.
 */
export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  fine_tuning: VoiceFineTuning;
  labels: VoiceLabels | null;
  preview_url: string;
  available_for_tiers: string[];
  settings: VoiceSettings | null;
  sharing: unknown;
  high_quality_base_model_ids: string[];
}

/**
 * Subscription information.
 */
export interface Subscription {
  tier: string;
  character_count: number;
  character_limit: number;
  can_extend_character_limit: boolean;
  allowed_to_extend_character_limit: boolean;
  next_character_count_reset_unix: number;
  voice_limit: number;
  professional_voice_limit: number;
  can_extend_voice_limit: boolean;
  can_use_instant_voice_cloning: boolean;
  can_use_professional_voice_cloning: boolean;
  currency: string;
  status: string;
}

/**
 * User information.
 */
export interface User {
  subscription: Subscription;
  is_new_user: boolean;
  xi_api_key: string;
  can_use_delayed_payment_methods: boolean;
  first_name?: string;
}

/**
 * API error response.
 */
export interface ElevenLabsError {
  detail: {
    status: string;
    message: string;
  };
}

/**
 * Default voice settings.
 */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
};

/**
 * Available models.
 */
export const ELEVENLABS_MODELS: ElevenLabsModel[] = [
  'eleven_multilingual_v2',
  'eleven_turbo_v2_5',
  'eleven_turbo_v2',
  'eleven_flash_v2_5',
  'eleven_flash_v2',
  'eleven_monolingual_v1',
  'eleven_multilingual_v1',
];

/**
 * Available output formats.
 */
export const OUTPUT_FORMATS: OutputFormat[] = [
  'mp3_44100_128',
  'mp3_44100_192',
  'pcm_16000',
  'pcm_22050',
  'pcm_24000',
  'pcm_44100',
  'ulaw_8000',
];
