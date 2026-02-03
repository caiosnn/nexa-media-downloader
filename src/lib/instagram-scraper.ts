/**
 * Instagram Scraper Engine
 * Multiple fallback methods for downloading Instagram stories
 */

import { cacheUserId, getCachedUserId, cacheStories, getCachedStories, type StoryItem } from './cache';

// Puppeteer launch options - uses system Chromium in Docker via PUPPETEER_EXECUTABLE_PATH
function getPuppeteerLaunchOptions(extraArgs: string[] = []) {
  return {
    headless: true as const,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      ...extraArgs,
    ],
  };
}

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
  userInfo?: UserInfo;
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
 * Method 0: Fetch via StoriesIG.info (Anonymous Story Viewer)
 * Completely free, no login required. Uses Puppeteer to scrape storiesig.info
 * which acts as an anonymous Instagram story viewer service.
 */
async function fetchViaStoriesIG(username: string): Promise<ScraperResult> {
  console.log(`[StoriesIG] Attempting to fetch stories for @${username}`);

  let browser = null;

  try {
    const puppeteer = await import('puppeteer');

    browser = await puppeteer.default.launch(getPuppeteerLaunchOptions(['--window-size=1920,1080']));

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate to StoriesIG to get the signing function
    console.log('[StoriesIG] Navigating to storiesig.info...');
    await page.goto('https://storiesig.info/', {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    // Find and use the search input (triggers the Vue app & signing setup)
    const input = await page.$('input[type="text"], input[type="search"]');
    if (!input) {
      console.log('[StoriesIG] No search input found on page');
      await browser.close();
      return { success: false, error: 'StoriesIG page layout changed', method: 'StoriesIG' };
    }

    await input.click();
    await page.keyboard.type(username, { delay: 30 });
    await page.keyboard.press('Enter');
    console.log(`[StoriesIG] Searching for @${username}...`);

    // Wait for the initial search to complete (sets up signing context)
    await sleep(8000);

    // Call the stories API endpoint directly using the frontend's signing function
    // This returns ALL stories (the DOM only renders a subset)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiResult: any = await page.evaluate(async (user: string) => {
      try {
        // Access the Vue app's signing function
        const appEl = document.querySelector('#app');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const app = appEl && (appEl as any).__vue_app__;
        if (!app) return { error: 'Vue app not found' };

        const ctrl = app.config.globalProperties.$mediaSearchController;
        if (!ctrl || !ctrl.subscribeSignedRequestBody) return { error: 'Controller not found' };

        const body = await ctrl.subscribeSignedRequestBody({ username: user });

        // Fetch user info
        const userResp = await fetch(`https://${ctrl.options.workerHubDomain}/api/v1/instagram/userInfo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body),
        });
        const userData = await userResp.json().catch(() => null);

        // Fetch stories using the dedicated stories endpoint
        const storiesResp = await fetch(`https://${ctrl.options.workerHubDomain}/api/v1/instagram/stories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body),
        });
        const storiesData = await storiesResp.json().catch(() => null);

        return {
          user: userData?.result?.[0]?.user || null,
          stories: storiesData?.result || [],
        };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    }, username);

    await browser.close();
    browser = null;

    if (apiResult.error) {
      console.log(`[StoriesIG] API error: ${apiResult.error}`);
      return { success: false, error: apiResult.error, method: 'StoriesIG' };
    }

    // Parse stories from the API response
    const storyItems = apiResult.stories || [];
    console.log(`[StoriesIG] Stories API returned ${storyItems.length} items`);

    if (storyItems.length > 0) {
      const stories: StoryItem[] = [];
      for (const item of storyItems) {
        const isVideo = !!(item.video_versions && item.video_versions.length > 0);
        let mediaUrl = '';
        let thumbnailUrl = '';

        if (isVideo) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sorted = [...item.video_versions].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
          mediaUrl = sorted[0]?.url || '';
          thumbnailUrl = item.image_versions2?.candidates?.[0]?.url || '';
        } else {
          const candidates = item.image_versions2?.candidates || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sorted = [...candidates].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
          mediaUrl = sorted[0]?.url || '';
        }

        if (mediaUrl) {
          stories.push({
            id: String(item.pk || item.id || `storiesig_${Date.now()}_${stories.length}`),
            mediaType: isVideo ? 'video' : 'image',
            url: mediaUrl,
            thumbnailUrl: thumbnailUrl || (isVideo ? undefined : mediaUrl),
            takenAt: item.taken_at || Math.floor(Date.now() / 1000),
          });
        }
      }

      if (stories.length > 0) {
        // Build user info from API data
        const apiUser = apiResult.user;
        const resolvedUserInfo: UserInfo | undefined = apiUser ? {
          id: String(apiUser.pk || apiUser.pk_id || ''),
          username: apiUser.username || username,
          fullName: apiUser.full_name || '',
          isPrivate: apiUser.is_private || false,
          profilePicUrl: apiUser.profile_pic_url || '',
        } : undefined;

        // Cache
        if (resolvedUserInfo) {
          cacheUserId(username, resolvedUserInfo.id);
        }

        cacheStories(username, {
          userId: resolvedUserInfo?.id || username,
          username,
          stories,
          fetchedAt: Date.now(),
        });

        console.log(`[StoriesIG] Successfully fetched ${stories.length} stories`);
        return { success: true, stories, userInfo: resolvedUserInfo, method: 'StoriesIG' };
      }
    }

    // No stories found — could mean user has no active stories
    console.log('[StoriesIG] No stories found (user may have no active stories)');
    return { success: false, error: 'No stories available', method: 'StoriesIG' };
  } catch (error) {
    console.error('[StoriesIG] Error:', error);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return { success: false, error: String(error), method: 'StoriesIG' };
  }
}

/**
 * Fetch user info via StoriesIG (no login required)
 */
export async function fetchUserInfoViaStoriesIG(username: string): Promise<UserInfo | null> {
  console.log(`[StoriesIG] Fetching user info for @${username}`);

  let browser = null;

  try {
    const puppeteer = await import('puppeteer');

    browser = await puppeteer.default.launch(getPuppeteerLaunchOptions());

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto('https://storiesig.info/', { waitUntil: 'networkidle2', timeout: 20000 });

    const input = await page.$('input[type="text"], input[type="search"]');
    if (!input) {
      await browser.close();
      return null;
    }

    await input.click();
    await page.keyboard.type(username, { delay: 30 });
    await page.keyboard.press('Enter');

    // Wait for signing context to be ready
    await sleep(6000);

    // Call userInfo API using the frontend's signing function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiUser: any = await page.evaluate(async (user: string) => {
      try {
        const appEl = document.querySelector('#app');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const app = appEl && (appEl as any).__vue_app__;
        if (!app) return null;
        const ctrl = app.config.globalProperties.$mediaSearchController;
        if (!ctrl?.subscribeSignedRequestBody) return null;

        const body = await ctrl.subscribeSignedRequestBody({ username: user });
        const resp = await fetch(`https://${ctrl.options.workerHubDomain}/api/v1/instagram/userInfo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        return data?.result?.[0]?.user || null;
      } catch {
        return null;
      }
    }, username);

    await browser.close();

    if (apiUser) {
      const userInfo: UserInfo = {
        id: String(apiUser.pk || apiUser.pk_id || ''),
        username: apiUser.username || username,
        fullName: apiUser.full_name || '',
        isPrivate: apiUser.is_private || false,
        profilePicUrl: apiUser.profile_pic_url || '',
      };
      console.log(`[StoriesIG] Got user info: ${userInfo.username}`);
      return userInfo;
    }

    return null;
  } catch (error) {
    console.error('[StoriesIG] User info error:', error);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return null;
  }
}

/**
 * Method 1: Fetch via Instaloader (Python) with session
 * Requires saved session — used as fallback if StoriesIG fails
 */
async function fetchViaInstaloader(username: string): Promise<ScraperResult> {
  console.log(`[Instaloader] Attempting to fetch stories for @${username}`);

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const { existsSync, readdirSync } = await import('fs');
  const pathMod = await import('path');
  const execAsync = promisify(exec);

  // Check if we have any session files first (no point running Python without one)
  const sessionDir = pathMod.default.join(process.cwd(), '.instagram-session');
  const defaultSessionDir = pathMod.default.join(
    process.env.LOCALAPPDATA || '',
    'Instaloader'
  );

  let hasSession = false;
  const sessionPaths: string[] = [];

  // Check project session dir
  if (existsSync(sessionDir)) {
    const files = readdirSync(sessionDir).filter(f => f.startsWith('session-'));
    for (const f of files) {
      sessionPaths.push(pathMod.default.join(sessionDir, f));
      hasSession = true;
    }
  }

  // Check default instaloader session dir
  if (!hasSession && existsSync(defaultSessionDir)) {
    const files = readdirSync(defaultSessionDir).filter(f => f.startsWith('session-'));
    for (const f of files) {
      sessionPaths.push(pathMod.default.join(defaultSessionDir, f));
      hasSession = true;
    }
  }

  if (!hasSession) {
    console.log('[Instaloader] No session files found, skipping');
    return { success: false, error: 'No Instagram session - login required', method: 'Instaloader' };
  }

  // Build Python script with the session paths we found
  const sessionPathsEscaped = sessionPaths.map(p => p.replace(/\\/g, '\\\\')).join('|');

  const pythonScript = `
import json, sys, os

try:
    import instaloader
except ImportError:
    print(json.dumps({"error": "instaloader not installed"}))
    sys.exit(0)

L = instaloader.Instaloader(
    download_pictures=False,
    download_videos=False,
    download_video_thumbnails=False,
    download_comments=False,
    download_geotags=False,
    save_metadata=False,
    compress_json=False,
    quiet=True
)

logged_in = False
session_paths = "${sessionPathsEscaped}".split("|")

for sp in session_paths:
    if not os.path.isfile(sp):
        continue
    try:
        login_name = os.path.basename(sp).replace("session-", "")
        L.load_session_from_file(login_name, sp)
        test = L.test_login()
        if test:
            logged_in = True
            break
    except Exception:
        pass

if not logged_in:
    print(json.dumps({"error": "login_required", "stories": []}))
    sys.exit(0)

try:
    profile = instaloader.Profile.from_username(L.context, "${username}")
except Exception as e:
    print(json.dumps({"error": str(e), "stories": []}))
    sys.exit(0)

result = {
    "user": {
        "id": str(profile.userid),
        "username": profile.username,
        "fullName": profile.full_name,
        "isPrivate": profile.is_private,
        "profilePicUrl": str(profile.profile_pic_url)
    },
    "stories": [],
    "logged_in": True
}

try:
    stories_iter = L.get_stories(userids=[profile.userid])
    for story in stories_iter:
        for item in story.get_items():
            story_data = {
                "id": str(item.mediaid),
                "mediaType": "video" if item.is_video else "image",
                "takenAt": int(item.date_utc.timestamp())
            }
            if item.is_video:
                story_data["url"] = str(item.video_url)
                story_data["thumbnailUrl"] = str(item.url)
            else:
                story_data["url"] = str(item.url)
            result["stories"].append(story_data)
except instaloader.exceptions.LoginRequiredException:
    result["error"] = "login_required"
except Exception as e:
    result["error"] = str(e)

print(json.dumps(result))
`.trim();

  try {
    const osMod = await import('os');
    const fsMod = await import('fs');
    const tmpScript = pathMod.default.join(osMod.default.tmpdir(), `ig_stories_${Date.now()}.py`);
    fsMod.writeFileSync(tmpScript, pythonScript, 'utf-8');

    let stdout = '';
    let stderr = '';
    try {
      const result = await execAsync(`python "${tmpScript}"`, {
        timeout: 45000,
        maxBuffer: 5 * 1024 * 1024,
        cwd: process.cwd(),
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } finally {
      try { fsMod.unlinkSync(tmpScript); } catch {}
    }

    if (stderr) {
      console.log(`[Instaloader] stderr: ${stderr.substring(0, 200)}`);
    }

    if (!stdout.trim()) {
      return { success: false, error: 'No output from instaloader', method: 'Instaloader' };
    }

    const data = JSON.parse(stdout.trim());

    if (data.error && data.error !== 'login_required') {
      console.log(`[Instaloader] Error: ${data.error}`);
      return { success: false, error: data.error, method: 'Instaloader' };
    }

    if (data.stories && data.stories.length > 0) {
      console.log(`[Instaloader] Found ${data.stories.length} stories (logged_in: ${data.logged_in})`);
      const stories: StoryItem[] = data.stories.map((s: any) => ({
        id: s.id,
        mediaType: s.mediaType,
        url: s.url,
        thumbnailUrl: s.thumbnailUrl,
        takenAt: s.takenAt,
      }));

      // Cache user ID
      if (data.user?.id) {
        cacheUserId(username, data.user.id);
      }

      cacheStories(username, {
        userId: data.user?.id || username,
        username,
        stories,
        fetchedAt: Date.now(),
      });

      return { success: true, stories, method: 'Instaloader' };
    }

    if (data.error === 'login_required') {
      console.log('[Instaloader] Login required for stories');
      return { success: false, error: 'Login required - conecte o Instagram nas configuracoes', method: 'Instaloader' };
    }

    // Return user info even without stories (may be empty)
    return { success: false, error: 'No stories available', method: 'Instaloader' };
  } catch (error) {
    console.error('[Instaloader] Error:', error);
    return { success: false, error: String(error), method: 'Instaloader' };
  }
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
 * Intercepts network responses to capture story data from API calls,
 * then navigates through all stories collecting media URLs.
 */
async function fetchViaPuppeteer(username: string, storyId?: string): Promise<ScraperResult> {
  console.log(`[Puppeteer] Attempting to fetch stories for @${username}`);

  let browser = null;

  try {
    const puppeteer = await import('puppeteer');

    browser = await puppeteer.default.launch(getPuppeteerLaunchOptions(['--window-size=1920,1080']));

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(getRandomUserAgent());
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Intercept network responses to capture story API data
    const interceptedStories: StoryItem[] = [];

    page.on('response', async (response) => {
      try {
        const url = response.url();
        // Capture story-related API responses
        if (
          (url.includes('/api/v1/feed/reels_media') ||
           url.includes('/api/v1/feed/user/') && url.includes('/story/') ||
           url.includes('/api/v1/feed/reels_tray')) &&
          response.status() === 200
        ) {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            // Parse stories from different response formats
            const items = data.reel?.items ||
                          data.reels_media?.[0]?.items ||
                          (Object.values(data.reels || {}) as any[])?.[0]?.items ||
                          [];
            if (Array.isArray(items)) {
              const parsed = parseStoryItems(items);
              for (const s of parsed) {
                if (!interceptedStories.find(existing => existing.id === s.id)) {
                  interceptedStories.push(s);
                }
              }
              if (parsed.length > 0) {
                console.log(`[Puppeteer] Intercepted ${parsed.length} stories from API response`);
              }
            }
          } catch {
            // Not JSON or parsing failed
          }
        }
      } catch {
        // Response body may not be available
      }
    });

    const storyUrl = storyId
      ? `https://www.instagram.com/stories/${username}/${storyId}/`
      : `https://www.instagram.com/stories/${username}/`;

    console.log(`[Puppeteer] Navigating to: ${storyUrl}`);

    await page.goto(storyUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await sleep(3000);

    // Check for login wall
    const loginWall = await page.$('input[name="username"]');
    if (loginWall) {
      console.log('[Puppeteer] Login wall detected');
      await browser.close();
      return { success: false, error: 'Login required', method: 'Puppeteer' };
    }

    // If we got stories from network interception, use those (most reliable)
    if (interceptedStories.length > 0) {
      console.log(`[Puppeteer] Got ${interceptedStories.length} stories from network interception`);
      await browser.close();
      cacheStories(username, {
        userId: username,
        username,
        stories: interceptedStories,
        fetchedAt: Date.now(),
      });
      return { success: true, stories: interceptedStories, method: 'Puppeteer' };
    }

    // Fallback: navigate through stories collecting media from DOM
    const collectedMedia: { url: string; isVideo: boolean }[] = [];
    const seenUrls = new Set<string>();

    // Helper to extract current story media from page
    const extractCurrentMedia = async () => {
      const media = await page.evaluate(() => {
        const result: { url: string; isVideo: boolean }[] = [];

        // Videos
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          const src = video.src || video.querySelector('source')?.src;
          if (src && src.includes('cdninstagram')) {
            result.push({ url: src, isVideo: true });
          }
        });

        // Images (story images, not profile pics or small thumbnails)
        const images = document.querySelectorAll('img[src*="cdninstagram"]');
        images.forEach(img => {
          const src = (img as HTMLImageElement).src;
          const width = (img as HTMLImageElement).naturalWidth || parseInt((img as HTMLImageElement).getAttribute('width') || '0');
          if (src && !src.includes('profile') && !src.includes('s150x150') && !src.includes('s320x320') && width > 200) {
            result.push({ url: src, isVideo: false });
          }
        });

        return result;
      });

      for (const item of media) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          collectedMedia.push(item);
        }
      }
    };

    // Extract first story
    await extractCurrentMedia();

    // Try clicking "next" to navigate through stories (up to 50 stories max)
    for (let i = 0; i < 50; i++) {
      // Try to find and click the "next" button
      const clicked = await page.evaluate(() => {
        // Instagram story "next" button is typically on the right side of the screen
        // It's a button or div that advances to the next story
        const nextBtn =
          document.querySelector('button[aria-label="Next"]') ||
          document.querySelector('button[aria-label="Avançar"]') ||
          document.querySelector('button[aria-label="Próximo"]') ||
          document.querySelector('[class*="LeftChevron"]')?.parentElement?.nextElementSibling ||
          document.querySelector('div[role="button"][tabindex="0"]');

        // Also try clicking the right side of the story viewer
        const storyContainer = document.querySelector('[role="presentation"]') ||
                              document.querySelector('[class*="story"]');

        if (nextBtn) {
          (nextBtn as HTMLElement).click();
          return true;
        }

        return false;
      });

      if (!clicked) {
        // Try pressing right arrow key as alternative
        await page.keyboard.press('ArrowRight');
      }

      await sleep(800);

      const prevCount = collectedMedia.length;
      await extractCurrentMedia();

      // Also check intercepted stories after navigation
      if (interceptedStories.length > 0) {
        console.log(`[Puppeteer] Got ${interceptedStories.length} stories from network after navigation`);
        await browser.close();
        cacheStories(username, {
          userId: username,
          username,
          stories: interceptedStories,
          fetchedAt: Date.now(),
        });
        return { success: true, stories: interceptedStories, method: 'Puppeteer' };
      }

      // If no new media found after navigation, we've seen all stories
      if (collectedMedia.length === prevCount) {
        // Try one more time with a longer wait
        await sleep(1500);
        await extractCurrentMedia();
        if (collectedMedia.length === prevCount) {
          console.log(`[Puppeteer] No new media after navigation, stopping at ${collectedMedia.length} items`);
          break;
        }
      }
    }

    await browser.close();

    if (collectedMedia.length > 0) {
      console.log(`[Puppeteer] Collected ${collectedMedia.length} media items from DOM navigation`);
      const stories: StoryItem[] = collectedMedia.map((item, index) => ({
        id: `puppeteer_${Date.now()}_${index}`,
        mediaType: item.isVideo ? 'video' : 'image',
        url: item.url,
        thumbnailUrl: item.isVideo ? undefined : item.url,
        takenAt: Math.floor(Date.now() / 1000) - (collectedMedia.length - index) * 3600,
      }));

      cacheStories(username, {
        userId: username,
        username,
        stories,
        fetchedAt: Date.now(),
      });

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
export async function fetchStories(username: string, skipCache = false): Promise<ScraperResult> {
  console.log(`\n========== Fetching stories for @${username} ==========`);

  // Check cache first
  if (!skipCache) {
    const cached = getCachedStories(username);
    if (cached && cached.stories.length > 0) {
      console.log(`[Cache] Found ${cached.stories.length} cached stories`);
      return { success: true, stories: cached.stories, method: 'Cache' };
    }
  }

  // Primary method: StoriesIG (anonymous, no login required)
  const storiesIGResult = await fetchViaStoriesIG(username);
  if (storiesIGResult.success) {
    return storiesIGResult;
  }
  console.log(`[StoriesIG] Failed: ${storiesIGResult.error}`);

  // Fallback: Instaloader with saved session (if available)
  const instaloaderResult = await fetchViaInstaloader(username);
  if (instaloaderResult.success) {
    return instaloaderResult;
  }
  console.log(`[Instaloader] Failed: ${instaloaderResult.error}`);

  // Fallback: Web API (may work without auth for some profiles)
  const webApiResult = await fetchViaWebAPI(username);
  if (webApiResult.success) {
    return webApiResult;
  }
  console.log(`[WebAPI] Failed: ${webApiResult.error}`);
  await sleep(1000);

  // Fallback: GraphQL
  const graphqlResult = await fetchViaGraphQL(username);
  if (graphqlResult.success) {
    return graphqlResult;
  }
  console.log(`[GraphQL] Failed: ${graphqlResult.error}`);

  // All methods failed
  return {
    success: false,
    error: storiesIGResult.error === 'No stories available'
      ? 'Nenhum story ativo no momento.'
      : 'Nao foi possivel obter os stories. Tente novamente mais tarde.',
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

/**
 * Fetch user info via Instaloader
 */
export async function fetchUserInfoViaInstaloader(username: string): Promise<UserInfo | null> {
  console.log(`[Instaloader] Fetching user info for @${username}`);

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const fsMod = await import('fs');
  const osMod = await import('os');
  const pathMod2 = await import('path');
  const execAsync = promisify(exec);

  const pythonScript = `
import json, sys
try:
    import instaloader
    L = instaloader.Instaloader(quiet=True, download_pictures=False, download_videos=False, save_metadata=False)
    profile = instaloader.Profile.from_username(L.context, ${JSON.stringify(username)})
    print(json.dumps({
        "id": str(profile.userid),
        "username": profile.username,
        "fullName": profile.full_name,
        "isPrivate": profile.is_private,
        "profilePicUrl": str(profile.profile_pic_url)
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`.trim();

  const tmpScript = pathMod2.default.join(osMod.default.tmpdir(), `ig_userinfo_${Date.now()}.py`);

  try {
    fsMod.writeFileSync(tmpScript, pythonScript, 'utf-8');
    const { stdout } = await execAsync(`python "${tmpScript}"`, {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });
    try { fsMod.unlinkSync(tmpScript); } catch {}

    if (!stdout.trim()) return null;
    const data = JSON.parse(stdout.trim());
    if (data.error) {
      console.log(`[Instaloader] User info error: ${data.error}`);
      return null;
    }

    return {
      id: data.id,
      username: data.username,
      fullName: data.fullName,
      isPrivate: data.isPrivate,
      profilePicUrl: data.profilePicUrl,
    };
  } catch (e) {
    try { fsMod.unlinkSync(tmpScript); } catch {}
    console.error('[Instaloader] User info error:', e);
    return null;
  }
}

// Export types
export type { ScraperResult, UserInfo, DownloadResult, StoryItem };
