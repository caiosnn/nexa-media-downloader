import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync, writeFileSync, rmdirSync } from 'fs';
import path from 'path';
import { detectPlatform } from '@/lib/platform-detector';
import { downloadStory } from '@/lib/instagram-scraper';
import { downloadStoryViaRapidAPI, isRapidAPIConfigured } from '@/lib/instagram-rapidapi';
import { downloadRateLimiter, getClientIP } from '@/lib/rate-limiter';
import { validateCaptcha } from '@/lib/captcha';
import { cacheDownloadResult, getCachedDownloadResult } from '@/lib/cache';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes timeout

// Directory for downloads
const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');
const SESSION_DIR = path.join(process.cwd(), '.instagram-session');
const COOKIES_FILE = path.join(process.cwd(), 'cookies.txt');

// Ensure downloads directory exists
if (!existsSync(DOWNLOADS_DIR)) {
  mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Tool paths - configurable via env vars for Docker/Linux, with Windows fallbacks
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python314\\Scripts\\yt-dlp.exe';
const INSTALOADER_PATH = process.env.INSTALOADER_PATH || 'C:\\Users\\User\\AppData\\Roaming\\Python\\Python314\\Scripts\\instaloader.exe';
const FFMPEG_DIR = process.env.FFMPEG_DIR || 'C:\\Users\\User\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0.1-full_build\\bin';

interface DownloadRequest {
  url: string;
  captchaToken?: string;
  captchaAnswer?: string | number;
}

interface DownloadResponse {
  success: boolean;
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
  // Rate limit info
  rateLimitRemaining?: number;
  rateLimitResetIn?: number;
  requireCaptcha?: boolean;
}

// Get Instagram session info
function getInstagramSession(): { hasSession: boolean; sessionFile?: string; username?: string } {
  // Check for session files
  if (existsSync(SESSION_DIR)) {
    const files = readdirSync(SESSION_DIR);
    const sessionFile = files.find(f => f.startsWith('session-'));
    if (sessionFile) {
      return {
        hasSession: true,
        sessionFile: path.join(SESSION_DIR, sessionFile),
        username: sessionFile.replace('session-', ''),
      };
    }
  }

  // Check for cookies file
  if (existsSync(COOKIES_FILE)) {
    return { hasSession: true };
  }

  return { hasSession: false };
}

// Clean old files (older than 1 hour)
function cleanOldFiles() {
  try {
    const files = readdirSync(DOWNLOADS_DIR);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(DOWNLOADS_DIR, file);
      try {
        const stats = statSync(filePath);
        if (stats.isFile() && stats.mtimeMs < oneHourAgo) {
          unlinkSync(filePath);
        }
      } catch {
        // Ignore errors for individual files
      }
    }
  } catch (error) {
    console.error('Error cleaning old files:', error);
  }
}

// Common yt-dlp arguments
const YT_DLP_COMMON_ARGS = `--ffmpeg-location "${FFMPEG_DIR}" --no-playlist --no-warnings --no-check-certificates --windows-filenames`;

// Download using yt-dlp (YouTube, Twitter/X) with format fallback
async function downloadWithYtDlp(url: string, outputTemplate: string): Promise<{ stdout: string; stderr: string }> {
  // Use cookies file if available (helps bypass YouTube bot detection)
  let cookiesArg = '';
  if (existsSync(COOKIES_FILE)) {
    cookiesArg = `--cookies "${COOKIES_FILE}"`;
  }

  // Let yt-dlp use its default client fallback (ANDROID_VR works best without explicit config)
  // Try multiple format options for best compatibility
  const formatOptions = [
    '', // Let yt-dlp choose best format automatically
    '-f "bv*+ba/b" --merge-output-format mp4',
    '-f "b" --merge-output-format mp4',
  ];

  let lastError: unknown;
  for (const fmt of formatOptions) {
    const command = `"${YT_DLP_PATH}" ${YT_DLP_COMMON_ARGS} ${cookiesArg} ${fmt} -o "${outputTemplate}" "${url}"`.replace(/\s+/g, ' ').trim();
    console.log('Executing yt-dlp:', command);
    try {
      return await execAsync(command, {
        timeout: 110000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      lastError = error;
      console.log(`[yt-dlp] Format "${fmt || 'auto'}" failed, trying next...`);
    }
  }
  throw lastError;
}

// Download Instagram content using yt-dlp with cookies
async function downloadInstagramWithYtDlp(url: string, outputTemplate: string): Promise<{ stdout: string; stderr: string }> {
  let cookiesArg = '';

  // Use cookies file if available
  if (existsSync(COOKIES_FILE)) {
    cookiesArg = `--cookies "${COOKIES_FILE}"`;
  }

  const formats = ['-f "bv*+ba/b" --merge-output-format mp4', '-f "b" --merge-output-format mp4'];

  let lastError: unknown;
  for (const fmt of formats) {
    const command = `"${YT_DLP_PATH}" ${YT_DLP_COMMON_ARGS} ${cookiesArg} ${fmt} -o "${outputTemplate}" "${url}"`;
    console.log('Executing yt-dlp for Instagram:', command);
    try {
      return await execAsync(command, {
        timeout: 110000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      lastError = error;
      console.log(`[yt-dlp Instagram] Format "${fmt}" failed, trying next...`);
    }
  }
  throw lastError;
}

// Download Instagram story using instaloader with session
async function downloadInstagramStoryWithSession(
  username: string,
  storyId: string,
  sessionFile: string,
  timestamp: number
): Promise<string | null> {
  const outputDir = path.join(DOWNLOADS_DIR, `story_${timestamp}`);
  mkdirSync(outputDir, { recursive: true });

  // Get session username
  const sessionUsername = path.basename(sessionFile).replace('session-', '');

  // Download story using instaloader with session
  const command = `"${INSTALOADER_PATH}" --login="${sessionUsername}" --sessionfile="${sessionFile}" --dirname-pattern="${outputDir}" --filename-pattern="{owner_username}_{mediaid}" --no-metadata-json --no-compress-json --no-captions --stories-only -- ${username}`;
  console.log('Executing instaloader for story:', command);

  try {
    await execAsync(command, {
      timeout: 110000,
      maxBuffer: 10 * 1024 * 1024,
    });

    // Find downloaded files
    if (existsSync(outputDir)) {
      const userDir = path.join(outputDir, username);
      const searchDir = existsSync(userDir) ? userDir : outputDir;

      const allFiles = readdirSync(searchDir);
      const mediaFiles = allFiles.filter(f =>
        f.endsWith('.mp4') || f.endsWith('.jpg') || f.endsWith('.webp')
      );

      if (mediaFiles.length > 0) {
        // If specific storyId, try to find that one
        let targetFile = mediaFiles[0];
        if (storyId) {
          const matchingFile = mediaFiles.find(f => f.includes(storyId));
          if (matchingFile) targetFile = matchingFile;
        }

        const ext = path.extname(targetFile);
        const finalName = `instagram_story_${timestamp}${ext}`;
        const finalPath = path.join(DOWNLOADS_DIR, finalName);

        renameSync(path.join(searchDir, targetFile), finalPath);

        // Cleanup
        try {
          for (const f of readdirSync(searchDir)) {
            try { unlinkSync(path.join(searchDir, f)); } catch {}
          }
          if (searchDir !== outputDir) {
            try { rmdirSync(searchDir); } catch {}
          }
          try { rmdirSync(outputDir); } catch {}
        } catch {}

        return finalName;
      }
    }
  } catch (error) {
    console.error('Instaloader story error:', error);
  }

  // Cleanup on failure
  try {
    if (existsSync(outputDir)) {
      const cleanup = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const fp = path.join(dir, f);
          if (statSync(fp).isDirectory()) {
            cleanup(fp);
            rmdirSync(fp);
          } else {
            unlinkSync(fp);
          }
        }
      };
      cleanup(outputDir);
      rmdirSync(outputDir);
    }
  } catch {}

  return null;
}

// Extract shortcode from Instagram URL
function extractInstagramShortcode(url: string): string | null {
  const patterns = [
    /instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    /instagram\.com\/reels?\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract story info from URL
function extractStoryInfo(url: string): { username: string; storyId: string } | null {
  const match = url.match(/instagram\.com\/stories\/([a-zA-Z0-9_.-]+)\/(\d+)/);
  if (match) {
    return { username: match[1], storyId: match[2] };
  }
  return null;
}

// Download Instagram story via RapidAPI (Primary method)
async function downloadInstagramStoryWithRapidAPI(
  username: string,
  storyId: string,
  timestamp: number
): Promise<string | null> {
  console.log(`[RapidAPI] Attempting to download story for @${username}, storyId: ${storyId}`);

  try {
    const result = await downloadStoryViaRapidAPI(username, storyId);

    if (result.success && result.buffer) {
      const ext = result.isVideo ? '.mp4' : '.jpg';
      const finalName = `instagram_story_${timestamp}${ext}`;
      const finalPath = path.join(DOWNLOADS_DIR, finalName);

      // Write buffer to file
      writeFileSync(finalPath, result.buffer);

      if (existsSync(finalPath)) {
        const stats = statSync(finalPath);
        if (stats.size > 1000) {
          console.log('[RapidAPI] Story downloaded successfully:', finalName, 'Size:', stats.size);
          return finalName;
        } else {
          try { unlinkSync(finalPath); } catch {}
        }
      }
    }

    console.log('[RapidAPI] Download failed:', result.error);
  } catch (error) {
    console.error('[RapidAPI] Error:', error);
  }

  return null;
}

// Download Instagram story using the new scraper engine
async function downloadInstagramStoryWithScraper(
  username: string,
  storyId: string,
  timestamp: number
): Promise<string | null> {
  console.log(`[Scraper] Attempting to download story for @${username}, storyId: ${storyId}`);

  try {
    const result = await downloadStory(username, storyId);

    if (result.success && result.buffer) {
      const ext = result.isVideo ? '.mp4' : '.jpg';
      const finalName = `instagram_story_${timestamp}${ext}`;
      const finalPath = path.join(DOWNLOADS_DIR, finalName);

      // Write buffer to file
      writeFileSync(finalPath, result.buffer);

      if (existsSync(finalPath)) {
        const stats = statSync(finalPath);
        if (stats.size > 1000) {
          console.log('[Scraper] Story downloaded successfully:', finalName, 'Size:', stats.size);
          return finalName;
        } else {
          try { unlinkSync(finalPath); } catch {}
        }
      }
    }

    console.log('[Scraper] Download failed:', result.error);
  } catch (error) {
    console.error('[Scraper] Error:', error);
  }

  return null;
}

// Download Instagram using instaloader (fallback for posts/reels)
async function downloadInstagramWithInstaloader(url: string, timestamp: number): Promise<string | null> {
  const shortcode = extractInstagramShortcode(url);
  if (!shortcode) return null;

  const outputDir = path.join(DOWNLOADS_DIR, `insta_${timestamp}`);
  mkdirSync(outputDir, { recursive: true });

  const command = `"${INSTALOADER_PATH}" --dirname-pattern="${outputDir}" --filename-pattern="{shortcode}" --no-metadata-json --no-compress-json --no-captions -- -${shortcode}`;
  console.log('Executing instaloader:', command);

  try {
    await execAsync(command, {
      timeout: 110000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const files = readdirSync(outputDir);
    const mediaFile = files.find(f => f.endsWith('.mp4') || f.endsWith('.jpg'));

    if (mediaFile) {
      const finalName = `instagram_${timestamp}${path.extname(mediaFile)}`;
      const finalPath = path.join(DOWNLOADS_DIR, finalName);
      renameSync(path.join(outputDir, mediaFile), finalPath);

      // Cleanup
      try {
        for (const f of readdirSync(outputDir)) {
          unlinkSync(path.join(outputDir, f));
        }
        rmdirSync(outputDir);
      } catch {}

      return finalName;
    }
  } catch (error) {
    console.error('Instaloader error:', error);
  }

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse<DownloadResponse>> {
  const clientIP = getClientIP(request);

  try {
    const body: DownloadRequest = await request.json();
    const { url, captchaToken, captchaAnswer } = body;

    // Check rate limit
    const rateLimitResult = downloadRateLimiter.check(clientIP);

    // If rate limited and captcha required
    if (!rateLimitResult.allowed) {
      // If captcha provided, validate it
      if (captchaToken && captchaAnswer !== undefined) {
        const captchaResult = validateCaptcha(captchaToken, captchaAnswer);
        if (captchaResult.valid) {
          // Reset rate limit after successful captcha
          downloadRateLimiter.resetFailures(clientIP);
        } else {
          return NextResponse.json(
            {
              success: false,
              error: captchaResult.error || 'Captcha invalido',
              requireCaptcha: true,
              rateLimitRemaining: 0,
              rateLimitResetIn: rateLimitResult.resetIn,
            },
            {
              status: 429,
              headers: {
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(rateLimitResult.resetIn),
              },
            }
          );
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Limite de requisicoes atingido. Resolva o captcha para continuar.',
            requireCaptcha: rateLimitResult.requireCaptcha,
            rateLimitRemaining: 0,
            rateLimitResetIn: rateLimitResult.resetIn,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(rateLimitResult.resetIn),
            },
          }
        );
      }
    }

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL e obrigatoria' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = getCachedDownloadResult(url);
    if (cached && cached.success) {
      console.log('[Cache] Returning cached result for:', url);
      return NextResponse.json({
        ...cached,
        rateLimitRemaining: rateLimitResult.remaining,
        rateLimitResetIn: rateLimitResult.resetIn,
      });
    }

    // Detect platform
    const detection = detectPlatform(url);

    if (!detection.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plataforma nao suportada. Use links do YouTube, Instagram ou X.',
          rateLimitRemaining: rateLimitResult.remaining,
        },
        { status: 400 }
      );
    }

    // Clean old files
    cleanOldFiles();

    const timestamp = Date.now();
    // Use video title in filename: {timestamp}_{sanitized_title}.{ext}
    const outputTemplate = path.join(DOWNLOADS_DIR, `${timestamp}_%(title).80s.%(ext)s`);

    try {
      let downloadedFile: string | undefined;

      if (detection.platform === 'instagram') {
        const isStory = url.includes('/stories/');
        const storyInfo = isStory ? extractStoryInfo(url) : null;
        const session = getInstagramSession();

        // Handle stories
        if (isStory) {
          if (storyInfo) {
            // Method 0: Try RapidAPI first (if configured)
            if (isRapidAPIConfigured()) {
              console.log('[Download] Trying RapidAPI for stories (primary method)...');
              downloadedFile = await downloadInstagramStoryWithRapidAPI(
                storyInfo.username,
                storyInfo.storyId,
                timestamp
              ) || undefined;
            }

            // Method 1: Try scraper engine (multiple fallbacks included)
            if (!downloadedFile) {
              console.log('[Download] Trying scraper engine for stories...');
              downloadedFile = await downloadInstagramStoryWithScraper(
                storyInfo.username,
                storyInfo.storyId,
                timestamp
              ) || undefined;
            }

            // Method 2: Try with instaloader session if available
            if (!downloadedFile && session.hasSession && session.sessionFile) {
              console.log('[Download] Trying instaloader with session...');
              downloadedFile = await downloadInstagramStoryWithSession(
                storyInfo.username,
                storyInfo.storyId,
                session.sessionFile,
                timestamp
              ) || undefined;
            }

            // Method 3: Fallback to yt-dlp with cookies
            if (!downloadedFile && session.hasSession) {
              console.log('[Download] Trying yt-dlp with cookies...');
              try {
                await downloadInstagramWithYtDlp(url, outputTemplate);
                const files = readdirSync(DOWNLOADS_DIR);
                downloadedFile = files.find(f => f.startsWith(`${timestamp}_`));
              } catch (ytdlpError) {
                console.log('[Download] yt-dlp failed:', ytdlpError);
              }
            }
          }

          if (!downloadedFile) {
            const result: DownloadResponse = {
              success: false,
              error: 'Nao foi possivel baixar este story. O perfil pode ser privado ou o story expirou.',
              rateLimitRemaining: rateLimitResult.remaining,
            };
            return NextResponse.json(result, { status: 400 });
          }
        } else {
          // Handle posts and reels
          try {
            await downloadInstagramWithYtDlp(url, outputTemplate);
            const files = readdirSync(DOWNLOADS_DIR);
            downloadedFile = files.find(f => f.startsWith(`${timestamp}_`));
          } catch (ytdlpError) {
            console.log('[Download] yt-dlp failed, trying instaloader...');
            const instaloaderFile = await downloadInstagramWithInstaloader(url, timestamp);
            if (instaloaderFile) {
              downloadedFile = instaloaderFile;
            }
          }

          if (!downloadedFile) {
            const result: DownloadResponse = {
              success: false,
              error: 'Nao foi possivel baixar este conteudo do Instagram. Verifique se o perfil e publico.',
              rateLimitRemaining: rateLimitResult.remaining,
            };
            return NextResponse.json(result, { status: 400 });
          }
        }
      } else {
        // YouTube or Twitter/X
        await downloadWithYtDlp(url, outputTemplate);
        const files = readdirSync(DOWNLOADS_DIR);
        downloadedFile = files.find(f => f.startsWith(`${timestamp}_`));
      }

      if (!downloadedFile) {
        throw new Error('Arquivo nao encontrado apos download');
      }

      const filePath = path.join(DOWNLOADS_DIR, downloadedFile);
      const stats = statSync(filePath);

      const result: DownloadResponse = {
        success: true,
        fileName: downloadedFile,
        fileSize: stats.size,
        downloadUrl: `/api/download/file?name=${encodeURIComponent(downloadedFile)}`,
        rateLimitRemaining: rateLimitResult.remaining,
        rateLimitResetIn: rateLimitResult.resetIn,
      };

      // Cache the successful result
      cacheDownloadResult(url, {
        success: true,
        fileName: downloadedFile,
        fileSize: stats.size,
        downloadUrl: result.downloadUrl,
      });

      return NextResponse.json(result, {
        headers: {
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetIn),
        },
      });

    } catch (execError: unknown) {
      console.error('Download error:', execError);
      const errorMessage = execError instanceof Error ? execError.message : 'Erro desconhecido';

      let userError = 'Erro ao baixar. Verifique se o link esta correto e tente novamente.';
      let statusCode = 500;

      if (errorMessage.includes('Private') || errorMessage.includes('private')) {
        userError = 'Este conteudo e privado e nao pode ser baixado.';
        statusCode = 400;
      } else if (errorMessage.includes('unavailable') || errorMessage.includes('not available')) {
        userError = 'Este conteudo nao esta mais disponivel.';
        statusCode = 400;
      } else if (errorMessage.includes('login') || errorMessage.includes('Login')) {
        userError = 'Este conteudo requer autenticacao. Configure sua conta do Instagram nas configuracoes.';
        statusCode = 401;
      } else if (errorMessage.includes('rate limit')) {
        userError = 'Limite de requisicoes do Instagram atingido. Aguarde alguns minutos e tente novamente.';
        statusCode = 429;
      }

      return NextResponse.json(
        {
          success: false,
          error: userError,
          rateLimitRemaining: rateLimitResult.remaining,
        },
        { status: statusCode }
      );
    }

  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao processar download',
      },
      { status: 500 }
    );
  }
}
