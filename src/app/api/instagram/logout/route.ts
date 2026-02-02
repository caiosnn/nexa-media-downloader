import { NextResponse } from 'next/server';
import { existsSync, readdirSync, unlinkSync, rmdirSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const SESSION_DIR = path.join(process.cwd(), '.instagram-session');
const COOKIES_FILE = path.join(process.cwd(), 'cookies.txt');

interface LogoutResponse {
  success: boolean;
  message?: string;
}

export async function POST(): Promise<NextResponse<LogoutResponse>> {
  try {
    let deleted = false;

    // Remove session files
    if (existsSync(SESSION_DIR)) {
      const files = readdirSync(SESSION_DIR);
      for (const file of files) {
        try {
          unlinkSync(path.join(SESSION_DIR, file));
          deleted = true;
        } catch {
          // Ignore individual file errors
        }
      }

      // Try to remove directory
      try {
        rmdirSync(SESSION_DIR);
      } catch {
        // Directory might not be empty
      }
    }

    // Remove cookies file
    if (existsSync(COOKIES_FILE)) {
      try {
        unlinkSync(COOKIES_FILE);
        deleted = true;
      } catch {
        // Ignore
      }
    }

    return NextResponse.json({
      success: true,
      message: deleted ? 'Sessao removida com sucesso' : 'Nenhuma sessao ativa encontrada',
    });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({
      success: false,
      message: 'Erro ao remover sessao',
    });
  }
}
