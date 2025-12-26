/**
 * ElevenLabs Text-to-Speech Functions.
 *
 * Provides text-to-speech conversion functionality.
 */

import type { ElevenLabsClient } from './client';
import type { TTSOptions, ElevenLabsModel, OutputFormat, VoiceSettings } from './types';
import { DEFAULT_VOICE_SETTINGS } from './types';

/**
 * Default model for TTS.
 */
export const DEFAULT_MODEL: ElevenLabsModel = 'eleven_multilingual_v2';

/**
 * Default output format.
 */
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'mp3_44100_128';

/**
 * Convert text to speech and return audio buffer.
 */
export async function textToSpeech(client: ElevenLabsClient, options: TTSOptions): Promise<ArrayBuffer> {
  const { text, voiceId, modelId = DEFAULT_MODEL, voiceSettings, outputFormat = DEFAULT_OUTPUT_FORMAT } = options;

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for text-to-speech');
  }

  if (!voiceId) {
    throw new Error('Voice ID is required for text-to-speech');
  }

  const body = {
    text,
    model_id: modelId,
    voice_settings: voiceSettings || DEFAULT_VOICE_SETTINGS,
  };

  return client.postAudio(`/text-to-speech/${voiceId}?output_format=${outputFormat}`, body);
}

/**
 * Convert text to speech and return a stream.
 */
export async function textToSpeechStream(
  client: ElevenLabsClient,
  options: TTSOptions,
): Promise<ReadableStream<Uint8Array> | null> {
  const { text, voiceId, modelId = DEFAULT_MODEL, voiceSettings, outputFormat = DEFAULT_OUTPUT_FORMAT } = options;

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for text-to-speech');
  }

  if (!voiceId) {
    throw new Error('Voice ID is required for text-to-speech');
  }

  const body = {
    text,
    model_id: modelId,
    voice_settings: voiceSettings || DEFAULT_VOICE_SETTINGS,
  };

  return client.postStream(`/text-to-speech/${voiceId}/stream?output_format=${outputFormat}`, body);
}

/**
 * Convert an audio buffer to a Blob.
 */
export function audioBufferToBlob(buffer: ArrayBuffer, mimeType: string = 'audio/mpeg'): Blob {
  return new Blob([buffer], { type: mimeType });
}

/**
 * Create an object URL from an audio buffer.
 */
export function createAudioUrl(buffer: ArrayBuffer, mimeType: string = 'audio/mpeg'): string {
  const blob = audioBufferToBlob(buffer, mimeType);

  return URL.createObjectURL(blob);
}

/**
 * Play audio from a buffer (browser only).
 */
export async function playAudio(buffer: ArrayBuffer): Promise<void> {
  const url = createAudioUrl(buffer);
  const audio = new Audio(url);

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to play audio'));
    };

    audio.play().catch(reject);
  });
}

/**
 * Estimate character count for billing purposes.
 */
export function estimateCharacterCount(text: string): number {
  return text.length;
}

/**
 * Split long text into chunks for processing.
 */
export function splitTextIntoChunks(text: string, maxChunkSize: number = 5000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }

    // Try to split at sentence boundary.
    let splitIndex = remaining.lastIndexOf('. ', maxChunkSize);

    if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
      // Try to split at word boundary.
      splitIndex = remaining.lastIndexOf(' ', maxChunkSize);
    }

    if (splitIndex === -1 || splitIndex < maxChunkSize * 0.5) {
      // Force split at max size.
      splitIndex = maxChunkSize;
    } else {
      splitIndex += 1; // Include the space or period.
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}

/**
 * Concatenate multiple audio buffers.
 */
export function concatenateAudioBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return result.buffer;
}

/**
 * Convert long text to speech by splitting into chunks.
 */
export async function textToSpeechLong(client: ElevenLabsClient, options: TTSOptions): Promise<ArrayBuffer[]> {
  const chunks = splitTextIntoChunks(options.text);
  const results: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const buffer = await textToSpeech(client, { ...options, text: chunk });
    results.push(buffer);
  }

  return results;
}
