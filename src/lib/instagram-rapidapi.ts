/**
 * RapidAPI Instagram Scraper Client
 * Primary method for downloading Instagram stories with high reliability
 *
 * API: Instagram Scraper API2
 * Host: instagram-scraper-api2.p.rapidapi.com
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Settings file path
const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

// Types
interface RapidAPISettings {
  rapidApiKey: string;
  rapidApiEnabled: boolean;
  lastUpdated?: string;
}

interface StoryItem {
  id: string;
  mediaType: 'video' | 'image';
  url: string;
  thumbnailUrl?: string;
  takenAt: number;
}

interface RapidAPIStoryResponse {
  success: boolean;
  stories?: StoryItem[];
  error?: string;
}

interface RapidAPIUserInfo {
  id: string;
  username: string;
  fullName: string;
  isPrivate: boolean;
  profilePicUrl: string;
}

interface RapidAPIUserResponse {
  success: boolean;
  user?: RapidAPIUserInfo;
  error?: string;
}

// RapidAPI constants
const RAPIDAPI_HOST = 'instagram-scraper-api2.p.rapidapi.com';

/**
 * Load settings from file
 */
function loadSettings(): RapidAPISettings | null {
  try {
    if (!existsSync(SETTINGS_FILE)) {
      return null;
    }
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content) as RapidAPISettings;
  } catch (error) {
    console.error('[RapidAPI] Error loading settings:', error);
    return null;
  }
}

/**
 * Check if RapidAPI is configured and enabled
 */
export function isRapidAPIConfigured(): boolean {
  const settings = loadSettings();
  return !!(settings?.rapidApiKey && settings?.rapidApiEnabled);
}

/**
 * Get RapidAPI key (returns null if not configured)
 */
function getRapidAPIKey(): string | null {
  const settings = loadSettings();
  if (!settings?.rapidApiKey || !settings?.rapidApiEnabled) {
    return null;
  }
  return settings.rapidApiKey;
}

/**
 * Sleep helper for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch user info via RapidAPI
 */
export async function fetchUserInfoViaRapidAPI(username: string): Promise<RapidAPIUserResponse> {
  const apiKey = getRapidAPIKey();
  if (!apiKey) {
    return { success: false, error: 'RapidAPI not configured' };
  }

  console.log(`[RapidAPI] Fetching user info for @${username}`);

  const maxRetries = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `https://${RAPIDAPI_HOST}/v1/info?username_or_id=${encodeURIComponent(username)}`,
        {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': RAPIDAPI_HOST,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[RapidAPI] Rate limited, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${response.statusText}`;
        console.log(`[RapidAPI] Request failed: ${lastError}`);

        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'Invalid API key or subscription expired' };
        }

        if (attempt < maxRetries) {
          await sleep(Math.pow(2, attempt) * 500);
          continue;
        }
        break;
      }

      const data = await response.json();

      if (data.data) {
        const userData = data.data;
        return {
          success: true,
          user: {
            id: userData.id || userData.pk,
            username: userData.username,
            fullName: userData.full_name || '',
            isPrivate: userData.is_private || false,
            profilePicUrl: userData.profile_pic_url || userData.profile_pic_url_hd || '',
          },
        };
      }

      return { success: false, error: 'User not found' };

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[RapidAPI] Error on attempt ${attempt}:`, lastError);

      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 500);
      }
    }
  }

  return { success: false, error: lastError || 'Failed after retries' };
}

/**
 * Fetch stories via RapidAPI
 */
export async function fetchStoriesViaRapidAPI(username: string): Promise<RapidAPIStoryResponse> {
  const apiKey = getRapidAPIKey();
  if (!apiKey) {
    return { success: false, error: 'RapidAPI not configured' };
  }

  console.log(`[RapidAPI] Fetching stories for @${username}`);

  const maxRetries = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `https://${RAPIDAPI_HOST}/v1/stories?username_or_id=${encodeURIComponent(username)}`,
        {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': RAPIDAPI_HOST,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[RapidAPI] Rate limited, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${response.statusText}`;
        console.log(`[RapidAPI] Request failed: ${lastError}`);

        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'Invalid API key or subscription expired' };
        }

        if (response.status === 404) {
          return { success: false, error: 'User not found or no stories' };
        }

        if (attempt < maxRetries) {
          await sleep(Math.pow(2, attempt) * 500);
          continue;
        }
        break;
      }

      const data = await response.json();

      // Parse the response
      const stories = parseRapidAPIStories(data);

      if (stories.length > 0) {
        console.log(`[RapidAPI] Found ${stories.length} stories`);
        return { success: true, stories };
      }

      return { success: false, error: 'No stories available' };

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[RapidAPI] Error on attempt ${attempt}:`, lastError);

      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 500);
      }
    }
  }

  return { success: false, error: lastError || 'Failed after retries' };
}

/**
 * Parse stories from RapidAPI response
 */
function parseRapidAPIStories(data: any): StoryItem[] {
  const stories: StoryItem[] = [];

  try {
    // The API might return stories in different formats
    const items = data.items || data.data?.items || data.reel?.items || [];

    for (const item of items) {
      const id = item.pk || item.id || String(Date.now());
      const takenAt = item.taken_at || Math.floor(Date.now() / 1000);

      // Check if video
      if (item.video_versions && item.video_versions.length > 0) {
        // Get highest quality video
        const video = item.video_versions.sort((a: any, b: any) =>
          (b.width || 0) - (a.width || 0)
        )[0];

        stories.push({
          id: String(id),
          mediaType: 'video',
          url: video.url,
          thumbnailUrl: item.image_versions2?.candidates?.[0]?.url,
          takenAt,
        });
      }
      // Check if image
      else if (item.image_versions2?.candidates && item.image_versions2.candidates.length > 0) {
        // Get highest quality image
        const image = item.image_versions2.candidates.sort((a: any, b: any) =>
          (b.width || 0) - (a.width || 0)
        )[0];

        stories.push({
          id: String(id),
          mediaType: 'image',
          url: image.url,
          takenAt,
        });
      }
    }
  } catch (error) {
    console.error('[RapidAPI] Error parsing stories:', error);
  }

  return stories;
}

/**
 * Download media from URL with proper headers
 */
export async function downloadMediaViaRapidAPI(url: string): Promise<Buffer | null> {
  try {
    console.log(`[RapidAPI] Downloading media from: ${url.substring(0, 80)}...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.instagram.com/',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[RapidAPI] Download failed with status: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[RapidAPI] Downloaded ${buffer.length} bytes`);
    return buffer;

  } catch (error) {
    console.error('[RapidAPI] Error downloading media:', error);
    return null;
  }
}

/**
 * Main function: Download story via RapidAPI
 */
export async function downloadStoryViaRapidAPI(
  username: string,
  storyId: string
): Promise<{ success: boolean; buffer?: Buffer; isVideo?: boolean; error?: string }> {
  console.log(`\n========== [RapidAPI] Downloading story ${storyId} from @${username} ==========`);

  // Fetch stories
  const storiesResult = await fetchStoriesViaRapidAPI(username);

  if (!storiesResult.success || !storiesResult.stories) {
    return { success: false, error: storiesResult.error };
  }

  // Find the specific story
  let targetStory = storiesResult.stories.find(s =>
    s.id === storyId || s.id.includes(storyId) || storyId.includes(s.id)
  );

  // If not found by ID, use the first one
  if (!targetStory && storiesResult.stories.length > 0) {
    targetStory = storiesResult.stories[0];
    console.log(`[RapidAPI] Story ID ${storyId} not found, using first available story`);
  }

  if (!targetStory) {
    return { success: false, error: 'Story not found' };
  }

  console.log(`[RapidAPI] Downloading ${targetStory.mediaType}: ${targetStory.url.substring(0, 80)}...`);

  // Download the media
  const buffer = await downloadMediaViaRapidAPI(targetStory.url);

  if (!buffer || buffer.length < 1000) {
    return { success: false, error: 'Failed to download media or file too small' };
  }

  return {
    success: true,
    buffer,
    isVideo: targetStory.mediaType === 'video',
  };
}

/**
 * Test RapidAPI connection
 */
export async function testRapidAPIConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
  console.log('[RapidAPI] Testing connection...');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // Test with a known public account
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/v1/info?username_or_id=instagram`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'API key invalida ou assinatura expirada' };
    }

    if (response.status === 429) {
      return { success: false, error: 'Limite de requisicoes atingido. Tente novamente mais tarde.' };
    }

    if (!response.ok) {
      return { success: false, error: `Erro HTTP ${response.status}` };
    }

    const data = await response.json();

    if (data.data || data.id || data.username) {
      console.log('[RapidAPI] Connection test successful');
      return { success: true };
    }

    return { success: false, error: 'Resposta inesperada da API' };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[RapidAPI] Connection test failed:', message);

    if (message.includes('abort')) {
      return { success: false, error: 'Tempo limite excedido' };
    }

    return { success: false, error: `Erro de conexao: ${message}` };
  }
}

// Export types
export type { RapidAPIStoryResponse, RapidAPIUserResponse, RapidAPIUserInfo, StoryItem };
