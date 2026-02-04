import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// Directory for downloads
const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');

// Sanitize filename for HTTP Content-Disposition header (ASCII only)
function sanitizeFilenameForHeader(filename: string): string {
  // Replace common unicode characters with ASCII equivalents
  return filename
    .replace(/[""]/g, '"')  // Fancy quotes to regular quotes
    .replace(/['']/g, "'")  // Fancy apostrophes
    .replace(/[–—]/g, '-')  // En/em dashes
    .replace(/[…]/g, '...')  // Ellipsis
    .replace(/[^\x00-\x7F]/g, '_');  // Replace any remaining non-ASCII with underscore
}

// Encode filename for RFC 5987 (UTF-8 support in Content-Disposition)
function encodeRFC5987(filename: string): string {
  return encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A')
    .replace(/%(?:7C|60|5E)/g, unescape);
}

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

    // Create safe filename for Content-Disposition header
    // Use both ASCII fallback and UTF-8 encoded version for maximum compatibility
    const asciiFilename = sanitizeFilenameForHeader(sanitizedName);
    const utf8Filename = encodeRFC5987(sanitizedName);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`,
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
