/**
 * Instagram Scraper Engine
 * Multiple fallback methods for downloading Instagram stories
 */

import { cacheUserId, getCachedUserId, cacheStories, getCachedStories, type StoryItem } from './cache';

// User-Agent rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

const IG_APP_ID = '936619743392459';

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Base headers for Instagram requests
function getBaseHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://www.instagram.com',
    'Referer': 'https://www.instagram.com/',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };
}

// API headers with Instagram App ID
function getApiHeaders(): Record<string, string> {
  return {
    ...getBaseHeaders(),
    'X-IG-App-ID': IG_APP_ID,
    'X-Requested-With': 'XMLHttpRequest',
    'X-ASBD-ID': '129477',
  };
}

// Result types
interface ScraperResult {
  success: boolean;
  stories?: StoryItem[];
  error?: string;
  method?: string;
}

interface UserInfo {
  id: string;
  username: string;
  fullName: string;
  isPrivate: boolean;
  profilePicUrl: string;
}

interface DownloadResult {
  success: boolean;
  buffer?: Buffer;
  isVideo?: boolean;
  error?: string;
}

/**
 * Method 1: Fetch via Instagram Web API
 * Uses /api/v1/ endpoints with proper headers
 */
async function fetchViaWebAPI(username: string): Promise<ScraperResult> {
  console.log(`[WebAPI] Attempting to fetch stories for @${username}`);

  try {
    // Step 1: Get user info
    const userInfo = await getUserInfoViaAPI(username);
    if (!userInfo) {
      return { success: false, error: 'User not found', method: 'WebAPI' };
    }

    if (userInfo.isPrivate) {
      return { success: false, error: 'Profile is private', method: 'WebAPI' };
    }

    // Step 2: Get stories
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        `https://www.instagram.com/api/v1/feed/user/${userInfo.id}/story/`,
        {
          headers: getApiHeaders(),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        console.log(`[WebAPI] Story fetch failed: ${response.status}`);
        return { success: false, error: `HTTP ${response.status}`, method: 'WebAPI' };
      }

      const data = await response.json();
      const stories = parseStoryItems(data.reel?.items || []);

      if (stories.length > 0) {
        console.log(`[WebAPI] Found ${stories.length} stories`);
        cacheStories(username, {
          userId: userInfo.id,
          username: userInfo.username,
          stories,
          fetchedAt: Date.now(),
        });
        return { success: true, stories, method: 'WebAPI' };
      }

      return { success: false, error: 'No stories available', method: 'WebAPI' };
    } catch (fetchError) {
      clearTimeout(timeout);
      throw fetchError;
    }
  } catch (error) {
    console.error('[WebAPI] Error:', error);
    return { success: false, error: String(error), method: 'WebAPI' };
  }
}

/**
 * Method 2: Fetch via GraphQL endpoint
 */
async function fetchViaGraphQL(username: string): Promise<ScraperResult> {
  console.log(`[GraphQL] Attempting to fetch stories for @${username}`);

  try {
    // Get user ID first
    const userId = await getUserId(username);
    if (!userId) {
      return { success: false, error: 'User not found', method: 'GraphQL' };
    }

    // Try GraphQL query
    const variables = JSON.stringify({
      reel_ids: [userId],
      precomposed_overlay: false,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`,
        {
          headers: getApiHeaders(),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        console.log(`[GraphQL] Request failed: ${response.status}`);
        return { success: false, error: `HTTP ${response.status}`, method: 'GraphQL' };
      }

      const data = await response.json();
      const reels = data.reels || data.reels_media || {};
      const userReel = reels[userId];

      if (userReel?.items) {
        const stories = parseStoryItems(userReel.items);
        if (stories.length > 0) {
          console.log(`[GraphQL] Found ${stories.length} stories`);
          return { success: true, stories, method: 'GraphQL' };
        }
      }

      return { success: false, error: 'No stories found', method: 'GraphQL' };
    } catch (fetchError) {
      clearTimeout(timeout);
      throw fetchError;
    }
  } catch (error) {
    console.error('[GraphQL] Error:', error);
    return { success: false, error: String(error), method: 'GraphQL' };
  }
}

/**
 * Method 3: HTML Scraping
 * Extracts data from profile page HTML
 */
async function fetchViaHTMLScraping(username: string): Promise<ScraperResult> {
  console.log(`[HTML] Attempting to scrape profile for @${username}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const headers = {
      ...getBaseHeaders(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };

    try {
      const response = await fetch(`https://www.instagram.com/${username}/`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.log(`[HTML] Profile fetch failed: ${response.status}`);
        return { success: false, error: `HTTP ${response.status}`, method: 'HTML' };
      }

      const html = await response.text();

      // Try to extract user ID from various sources in the HTML
      const userIdMatch = html.match(/"user_id":"(\d+)"/) ||
                          html.match(/"profilePage_(\d+)"/) ||
                          html.match(/"owner":\{"id":"(\d+)"/) ||
                          html.match(/instagram:\/\/user\?username=[^"]+&amp;userId=(\d+)/);

      if (userIdMatch) {
        const userId = userIdMatch[1];
        console.log(`[HTML] Found user ID: ${userId}`);
        cacheUserId(username, userId);

        // Now try to fetch stories with this ID
        return await fetchViaWebAPI(username);
      }

      // Check if private
      if (html.includes('"is_private":true') || html.includes('This Account is Private')) {
        return { success: false, error: 'Profile is private', method: 'HTML' };
      }

      return { success: false, error: 'Could not extract user data from HTML', method: 'HTML' };
    } catch (fetchError) {
      clearTimeout(timeout);
      throw fetchError;
    }
  } catch (error) {
    console.error('[HTML] Error:', error);
    return { success: false, error: String(error), method: 'HTML' };
  }
}

/**
 * Method 4: Puppeteer (Headless Browser)
 * Most reliable but slowest method
 */
async function fetchViaPuppeteer(username: string, storyId?: string): Promise<ScraperResult> {
  console.log(`[Puppeteer] Attempting to fetch stories for @${username}`);

  let browser = null;

  try {
    // Dynamic import to avoid issues if puppeteer not installed
    const puppeteer = await import('puppeteer');

    browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(getRandomUserAgent());

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Navigate to story URL
    const storyUrl = storyId
      ? `https://www.instagram.com/stories/${username}/${storyId}/`
      : `https://www.instagram.com/stories/${username}/`;

    console.log(`[Puppeteer] Navigating to: ${storyUrl}`);

    await page.goto(storyUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for content to load
    await sleep(3000);

    // Check for login wall
    const loginWall = await page.$('input[name="username"]');
    if (loginWall) {
      console.log('[Puppeteer] Login wall detected');
      await browser.close();
      return { success: false, error: 'Login required', method: 'Puppeteer' };
    }

    // Try to extract media URLs from the page
    const mediaUrls = await page.evaluate(() => {
      const urls: { url: string; isVideo: boolean }[] = [];

      // Look for video elements
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        const src = video.src || video.querySelector('source')?.src;
        if (src && src.includes('cdninstagram')) {
          urls.push({ url: src, isVideo: true });
        }
      });

      // Look for image elements
      const images = document.querySelectorAll('img[src*="cdninstagram"]');
      images.forEach(img => {
        const src = (img as HTMLImageElement).src;
        if (src && !src.includes('profile') && !src.includes('s150x150')) {
          urls.push({ url: src, isVideo: false });
        }
      });

      return urls;
    });

    await browser.close();

    if (mediaUrls.length > 0) {
      console.log(`[Puppeteer] Found ${mediaUrls.length} media items`);
      const stories: StoryItem[] = mediaUrls.map((item, index) => ({
        id: `puppeteer_${Date.now()}_${index}`,
        mediaType: item.isVideo ? 'video' : 'image',
        url: item.url,
        takenAt: Math.floor(Date.now() / 1000),
      }));

      return { success: true, stories, method: 'Puppeteer' };
    }

    return { success: false, error: 'No media found on page', method: 'Puppeteer' };
  } catch (error) {
    console.error('[Puppeteer] Error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    return { success: false, error: String(error), method: 'Puppeteer' };
  }
}

/**
 * Get user info via API
 */
async function getUserInfoViaAPI(username: string): Promise<UserInfo | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      {
        headers: getApiHeaders(),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const user = data.data?.user;

    if (!user) {
      return null;
    }

    // Cache the user ID
    cacheUserId(username, user.id);

    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      isPrivate: user.is_private,
      profilePicUrl: user.profile_pic_url,
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

/**
 * Get user ID (cached or fetched)
 */
async function getUserId(username: string): Promise<string | null> {
  // Check cache first
  const cached = getCachedUserId(username);
  if (cached) {
    return cached;
  }

  // Fetch from API
  const userInfo = await getUserInfoViaAPI(username);
  return userInfo?.id || null;
}

/**
 * Parse story items from Instagram API response
 */
function parseStoryItems(items: any[]): StoryItem[] {
  const stories: StoryItem[] = [];

  for (const item of items) {
    try {
      const id = item.pk || item.id;
      const takenAt = item.taken_at || Math.floor(Date.now() / 1000);

      // Check if video
      if (item.video_versions && item.video_versions.length > 0) {
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
    } catch (error) {
      console.error('Error parsing story item:', error);
    }
  }

  return stories;
}

/**
 * Download media from URL
 */
async function downloadMedia(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.instagram.com/',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Download failed with status: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading media:', error);
    return null;
  }
}

/**
 * Main function: Fetch stories with all fallback methods
 */
export async function fetchStories(username: string): Promise<ScraperResult> {
  console.log(`\n========== Fetching stories for @${username} ==========`);

  // Check cache first
  const cached = getCachedStories(username);
  if (cached && cached.stories.length > 0) {
    console.log(`[Cache] Found ${cached.stories.length} cached stories`);
    return { success: true, stories: cached.stories, method: 'Cache' };
  }

  // Method 1: Web API
  const webApiResult = await fetchViaWebAPI(username);
  if (webApiResult.success) {
    return webApiResult;
  }
  console.log(`[WebAPI] Failed: ${webApiResult.error}`);
  await sleep(1000); // Rate limit protection

  // Method 2: GraphQL
  const graphqlResult = await fetchViaGraphQL(username);
  if (graphqlResult.success) {
    return graphqlResult;
  }
  console.log(`[GraphQL] Failed: ${graphqlResult.error}`);
  await sleep(1000);

  // Method 3: HTML Scraping
  const htmlResult = await fetchViaHTMLScraping(username);
  if (htmlResult.success) {
    return htmlResult;
  }
  console.log(`[HTML] Failed: ${htmlResult.error}`);
  await sleep(1000);

  // Method 4: Puppeteer (last resort)
  const puppeteerResult = await fetchViaPuppeteer(username);
  if (puppeteerResult.success) {
    return puppeteerResult;
  }
  console.log(`[Puppeteer] Failed: ${puppeteerResult.error}`);

  // All methods failed
  return {
    success: false,
    error: 'Nao foi possivel obter os stories. O perfil pode ser privado ou sem stories ativos.',
    method: 'All',
  };
}

/**
 * Main function: Download a specific story
 */
export async function downloadStory(
  username: string,
  storyId: string
): Promise<DownloadResult> {
  console.log(`\n========== Downloading story ${storyId} from @${username} ==========`);

  // Try to get stories
  const storiesResult = await fetchStories(username);

  if (!storiesResult.success || !storiesResult.stories) {
    return { success: false, error: storiesResult.error };
  }

  // Find the specific story
  let targetStory = storiesResult.stories.find(s =>
    s.id === storyId || s.id.includes(storyId)
  );

  // If not found by ID, just use the first one
  if (!targetStory && storiesResult.stories.length > 0) {
    targetStory = storiesResult.stories[0];
  }

  if (!targetStory) {
    return { success: false, error: 'Story not found' };
  }

  console.log(`Downloading ${targetStory.mediaType} from: ${targetStory.url.substring(0, 100)}...`);

  // Download the media
  const buffer = await downloadMedia(targetStory.url);

  if (!buffer || buffer.length < 1000) {
    return { success: false, error: 'Failed to download media or file too small' };
  }

  return {
    success: true,
    buffer,
    isVideo: targetStory.mediaType === 'video',
  };
}

// Export types
export type { ScraperResult, UserInfo, DownloadResult, StoryItem };
