import { NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const SESSION_DIR = path.join(process.cwd(), '.instagram-session');
const COOKIES_FILE = path.join(process.cwd(), 'cookies.txt');

interface StatusResponse {
  connected: boolean;
  username?: string;
  method?: 'session' | 'cookies';
  lastUpdated?: string;
}

export async function GET(): Promise<NextResponse<StatusResponse>> {
  try {
    // Check for session files first
    if (existsSync(SESSION_DIR)) {
      const files = readdirSync(SESSION_DIR);
      const sessionFile = files.find(f => f.startsWith('session-'));

      if (sessionFile) {
        const username = sessionFile.replace('session-', '');
        const sessionPath = path.join(SESSION_DIR, sessionFile);
        const stats = statSync(sessionPath);

        return NextResponse.json({
          connected: true,
          username,
          method: 'session',
          lastUpdated: stats.mtime.toISOString(),
        });
      }
    }

    // Check for cookies file
    if (existsSync(COOKIES_FILE)) {
      const stats = statSync(COOKIES_FILE);

      return NextResponse.json({
        connected: true,
        method: 'cookies',
        lastUpdated: stats.mtime.toISOString(),
      });
    }

    return NextResponse.json({
      connected: false,
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({
      connected: false,
    });
  }
}
