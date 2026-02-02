import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// Directory for downloads
const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('name');

    if (!fileName) {
      return NextResponse.json(
        { error: 'Nome do arquivo é obrigatório' },
        { status: 400 }
      );
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedName = path.basename(fileName);
    const filePath = path.join(DOWNLOADS_DIR, sanitizedName);

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = readFileSync(filePath);
    const stats = statSync(filePath);

    // Determine content type
    const ext = path.extname(sanitizedName).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${sanitizedName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });

  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json(
      { error: 'Erro ao servir arquivo' },
      { status: 500 }
    );
  }
}
