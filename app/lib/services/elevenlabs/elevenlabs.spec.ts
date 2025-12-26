/**
 * ElevenLabs SDK Tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElevenLabsClient, createElevenLabsClient } from './client';
import {
  textToSpeech,
  textToSpeechStream,
  audioBufferToBlob,
  createAudioUrl,
  estimateCharacterCount,
  splitTextIntoChunks,
  concatenateAudioBuffers,
  DEFAULT_MODEL,
  DEFAULT_OUTPUT_FORMAT,
} from './tts';
import { getVoices, getVoice, searchVoices, getVoiceName, COMMON_VOICES } from './voices';
import type { Voice, User } from './types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('ElevenLabsClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      expect(client).toBeInstanceOf(ElevenLabsClient);
    });

    it('should throw error without API key', () => {
      expect(() => new ElevenLabsClient({ apiKey: '' })).toThrow('ElevenLabs API key is required');
    });
  });

  describe('createElevenLabsClient', () => {
    it('should create client instance', () => {
      const client = createElevenLabsClient('test-key');
      expect(client).toBeInstanceOf(ElevenLabsClient);
    });
  });

  describe('get', () => {
    it('should make authenticated GET request', async () => {
      const mockResponse = { id: '123', name: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'xi-api-key': 'test-key',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('post', () => {
    it('should make authenticated POST request with JSON body', async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await client.post('/test', { data: 'value' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ data: 'value' }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('postAudio', () => {
    it('should return ArrayBuffer for audio', async () => {
      const mockBuffer = new ArrayBuffer(100);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await client.postAudio('/test', { text: 'hello' });

      expect(result).toBe(mockBuffer);
    });
  });

  describe('getUser', () => {
    it('should fetch user info', async () => {
      const mockUser: User = {
        subscription: {
          tier: 'free',
          character_count: 1000,
          character_limit: 10000,
          can_extend_character_limit: true,
          allowed_to_extend_character_limit: true,
          next_character_count_reset_unix: 1234567890,
          voice_limit: 3,
          professional_voice_limit: 0,
          can_extend_voice_limit: false,
          can_use_instant_voice_cloning: false,
          can_use_professional_voice_cloning: false,
          currency: 'usd',
          status: 'active',
        },
        is_new_user: false,
        xi_api_key: 'test-key',
        can_use_delayed_payment_methods: true,
        first_name: 'Test',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await client.getUser();

      expect(result).toEqual(mockUser);
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ subscription: { tier: 'free' } }),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await client.validateApiKey();

      expect(result).toBe(true);
    });

    it('should return false for invalid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: { message: 'Invalid API key' } }),
      });

      const client = new ElevenLabsClient({ apiKey: 'invalid-key' });
      const result = await client.validateApiKey();

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw for 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      await expect(client.get('/test')).rejects.toThrow('Invalid ElevenLabs API key');
    });

    it('should throw for 402 quota exceeded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: () => Promise.resolve({}),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      await expect(client.get('/test')).rejects.toThrow('ElevenLabs quota exceeded');
    });

    it('should throw for 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      await expect(client.get('/test')).rejects.toThrow('ElevenLabs rate limit exceeded');
    });
  });
});

describe('TTS Functions', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('textToSpeech', () => {
    it('should generate speech from text', async () => {
      const mockBuffer = new ArrayBuffer(100);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await textToSpeech(client, {
        text: 'Hello world',
        voiceId: COMMON_VOICES.RACHEL,
      });

      expect(result).toBe(mockBuffer);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/text-to-speech/${COMMON_VOICES.RACHEL}`),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello world'),
        }),
      );
    });

    it('should throw error for empty text', async () => {
      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      await expect(textToSpeech(client, { text: '', voiceId: 'voice-id' })).rejects.toThrow(
        'Text is required for text-to-speech',
      );
    });

    it('should throw error for missing voice ID', async () => {
      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      await expect(textToSpeech(client, { text: 'Hello', voiceId: '' })).rejects.toThrow(
        'Voice ID is required for text-to-speech',
      );
    });

    it('should use default model and format', async () => {
      const mockBuffer = new ArrayBuffer(100);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      await textToSpeech(client, { text: 'Test', voiceId: 'voice-id' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`output_format=${DEFAULT_OUTPUT_FORMAT}`),
        expect.objectContaining({
          body: expect.stringContaining(DEFAULT_MODEL),
        }),
      );
    });
  });

  describe('textToSpeechStream', () => {
    it('should return readable stream', async () => {
      const mockStream = new ReadableStream();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await textToSpeechStream(client, {
        text: 'Hello world',
        voiceId: 'voice-id',
      });

      expect(result).toBe(mockStream);
    });
  });

  describe('audioBufferToBlob', () => {
    it('should convert ArrayBuffer to Blob', () => {
      const buffer = new ArrayBuffer(100);
      const blob = audioBufferToBlob(buffer);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/mpeg');
    });

    it('should accept custom mime type', () => {
      const buffer = new ArrayBuffer(100);
      const blob = audioBufferToBlob(buffer, 'audio/wav');

      expect(blob.type).toBe('audio/wav');
    });
  });

  describe('createAudioUrl', () => {
    it('should create object URL from buffer', () => {
      const buffer = new ArrayBuffer(100);
      const url = createAudioUrl(buffer);

      expect(url).toBe('blob:mock-url');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('estimateCharacterCount', () => {
    it('should return text length', () => {
      expect(estimateCharacterCount('Hello')).toBe(5);
      expect(estimateCharacterCount('Hello World!')).toBe(12);
    });
  });

  describe('splitTextIntoChunks', () => {
    it('should return single chunk for short text', () => {
      const text = 'Short text';
      const chunks = splitTextIntoChunks(text);

      expect(chunks).toEqual([text]);
    });

    it('should split long text at sentence boundaries', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = splitTextIntoChunks(text, 30);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every((c) => c.length <= 30)).toBe(true);
    });

    it('should split at word boundaries when no sentences', () => {
      const text = 'word '.repeat(20);
      const chunks = splitTextIntoChunks(text, 30);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle text without spaces', () => {
      const text = 'a'.repeat(100);
      const chunks = splitTextIntoChunks(text, 30);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBe(30);
    });
  });

  describe('concatenateAudioBuffers', () => {
    it('should concatenate multiple buffers', () => {
      const buffer1 = new Uint8Array([1, 2, 3]).buffer;
      const buffer2 = new Uint8Array([4, 5, 6]).buffer;
      const result = concatenateAudioBuffers([buffer1, buffer2]);

      expect(result.byteLength).toBe(6);
      expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });

    it('should handle single buffer', () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const result = concatenateAudioBuffers([buffer]);

      expect(result.byteLength).toBe(3);
    });

    it('should handle empty array', () => {
      const result = concatenateAudioBuffers([]);

      expect(result.byteLength).toBe(0);
    });
  });
});

describe('Voice Functions', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const mockVoices: Voice[] = [
    {
      voice_id: 'voice1',
      name: 'Rachel',
      category: 'premade',
      fine_tuning: { is_allowed_to_fine_tune: false, language: 'en' },
      labels: { accent: 'american' },
      preview_url: 'https://example.com/preview1.mp3',
      available_for_tiers: ['free'],
      settings: null,
      sharing: null,
      high_quality_base_model_ids: [],
    },
    {
      voice_id: 'voice2',
      name: 'Thomas',
      category: 'cloned',
      fine_tuning: { is_allowed_to_fine_tune: true, language: 'en' },
      labels: { accent: 'british' },
      preview_url: 'https://example.com/preview2.mp3',
      available_for_tiers: ['creator'],
      settings: null,
      sharing: null,
      high_quality_base_model_ids: [],
    },
  ];

  describe('getVoices', () => {
    it('should fetch all voices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ voices: mockVoices }),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await getVoices(client);

      expect(result).toEqual(mockVoices);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/voices'), expect.any(Object));
    });
  });

  describe('getVoice', () => {
    it('should fetch voice by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVoices[0]),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await getVoice(client, 'voice1');

      expect(result).toEqual(mockVoices[0]);
    });

    it('should throw error for missing voice ID', async () => {
      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      await expect(getVoice(client, '')).rejects.toThrow('Voice ID is required');
    });
  });

  describe('searchVoices', () => {
    it('should search voices by name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ voices: mockVoices }),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await searchVoices(client, 'rachel');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Rachel');
    });

    it('should search voices by accent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ voices: mockVoices }),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await searchVoices(client, 'british');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Thomas');
    });

    it('should return empty for no matches', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ voices: mockVoices }),
      });

      const client = new ElevenLabsClient({ apiKey: 'test-key' });
      const result = await searchVoices(client, 'nonexistent');

      expect(result).toHaveLength(0);
    });
  });

  describe('getVoiceName', () => {
    it('should return voice name for known ID', () => {
      const name = getVoiceName(COMMON_VOICES.RACHEL);
      expect(name).toBe('RACHEL');
    });

    it('should return undefined for unknown ID', () => {
      const name = getVoiceName('unknown-id');
      expect(name).toBeUndefined();
    });
  });

  describe('COMMON_VOICES', () => {
    it('should have voice IDs', () => {
      expect(COMMON_VOICES.RACHEL).toBe('21m00Tcm4TlvDq8ikWAM');
      expect(COMMON_VOICES.ADAM).toBe('pNInz6obpgDQGcFmaJgB');
    });
  });
});
