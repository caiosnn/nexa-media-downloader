import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const COOKIES_FILE = path.join(process.cwd(), 'cookies.txt');

interface CookiesRequest {
  cookies: string;
}

interface CookiesResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<CookiesResponse>> {
  try {
    const body: CookiesRequest = await request.json();
    const { cookies } = body;

    if (!cookies || !cookies.trim()) {
      return NextResponse.json(
        { success: false, error: 'Conteudo dos cookies e obrigatorio' },
        { status: 400 }
      );
    }

    // Validate cookies format (Netscape format)
    const lines = cookies.trim().split('\n');
    const validLines = lines.filter(line => {
      // Skip comments and empty lines
      if (line.startsWith('#') || !line.trim()) return true;
      // Check if line has correct number of fields (7 for Netscape format)
      const fields = line.split('\t');
      return fields.length >= 7;
    });

    // Check if we have instagram.com cookies
    const hasInstagramCookies = lines.some(line =>
      line.includes('instagram.com') || line.includes('.instagram.com')
    );

    if (!hasInstagramCookies) {
      return NextResponse.json(
        { success: false, error: 'Nenhum cookie do Instagram encontrado. Certifique-se de exportar cookies do instagram.com' },
        { status: 400 }
      );
    }

    // Save cookies file
    try {
      writeFileSync(COOKIES_FILE, cookies.trim(), 'utf-8');
    } catch (writeError) {
      console.error('Error writing cookies file:', writeError);
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar arquivo de cookies' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cookies importados com sucesso',
    });

  } catch (error) {
    console.error('Cookies import error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar cookies' },
      { status: 500 }
    );
  }
}
