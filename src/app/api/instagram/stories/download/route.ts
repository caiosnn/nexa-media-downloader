import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync, writeFileSync, statSync, readdirSync, unlinkSync } from 'fs';
import path from 'path';
import { downloadStoryViaRapidAPI, isRapidAPIConfigured } from '@/lib/instagram-rapidapi';
import { downloadStory } from '@/lib/instagram-scraper';

export const runtime = 'nodejs';
export const maxDuration = 120;

const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');

if (!existsSync(DOWNLOADS_DIR)) {
  mkdirSync(DOWNLOADS_DIR, { recursive: true });
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
      } catch {}
    }
  } catch {}
}

export async function POST(request: NextRequest) {
  try {
    const { username, storyId } = await request.json();

    if (!username || !storyId) {
      return NextResponse.json(
        { success: false, error: 'Username e storyId sao obrigatorios' },
        { status: 400 }
      );
    }

    cleanOldFiles();

    const timestamp = Date.now();
    let downloadedFile: string | null = null;

    // Method 1: RapidAPI
    if (isRapidAPIConfigured()) {
      console.log(`[Story Download] Trying RapidAPI for @${username} story ${storyId}`);
      const result = await downloadStoryViaRapidAPI(username, storyId);
      if (result.success && result.buffer) {
        const ext = result.isVideo ? '.mp4' : '.jpg';
        const fileName = `instagram_story_${username}_${timestamp}${ext}`;
        const filePath = path.join(DOWNLOADS_DIR, fileName);
        writeFileSync(filePath, result.buffer);
        if (existsSync(filePath) && statSync(filePath).size > 1000) {
          downloadedFile = fileName;
        }
      }
    }

    // Method 2: Scraper fallback
    if (!downloadedFile) {
      console.log(`[Story Download] Trying scraper for @${username} story ${storyId}`);
      const result = await downloadStory(username, storyId);
      if (result.success && result.buffer) {
        const ext = result.isVideo ? '.mp4' : '.jpg';
        const fileName = `instagram_story_${username}_${timestamp}${ext}`;
        const filePath = path.join(DOWNLOADS_DIR, fileName);
        writeFileSync(filePath, result.buffer);
        if (existsSync(filePath) && statSync(filePath).size > 1000) {
          downloadedFile = fileName;
        }
      }
    }

    if (!downloadedFile) {
      return NextResponse.json(
        { success: false, error: 'Nao foi possivel baixar o story. Pode ter expirado.' },
        { status: 400 }
      );
    }

    const filePath = path.join(DOWNLOADS_DIR, downloadedFile);
    const stats = statSync(filePath);

    return NextResponse.json({
      success: true,
      fileName: downloadedFile,
      fileSize: stats.size,
      downloadUrl: `/api/download/file?name=${encodeURIComponent(downloadedFile)}`,
    });
  } catch (error) {
    console.error('[Story Download] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao baixar story' },
      { status: 500 }
    );
  }
}
