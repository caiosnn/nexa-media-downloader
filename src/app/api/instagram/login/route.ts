import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export const runtime = 'nodejs';

const SESSION_DIR = path.join(process.cwd(), '.instagram-session');

// Ensure session directory exists
if (!existsSync(SESSION_DIR)) {
  mkdirSync(SESSION_DIR, { recursive: true });
}

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username e senha sao obrigatorios' },
        { status: 400 }
      );
    }

    // Validate username format
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      return NextResponse.json(
        { success: false, error: 'Username invalido' },
        { status: 400 }
      );
    }

    const sessionFile = path.join(SESSION_DIR, `session-${username}`);

    // Write a temporary Python script (avoids shell escaping issues)
    const tmpScript = path.join(os.tmpdir(), `ig_login_${Date.now()}.py`);

    const pythonScript = `
import instaloader
import json
import sys

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

username = ${JSON.stringify(username)}
password = ${JSON.stringify(password)}
session_file = ${JSON.stringify(sessionFile.replace(/\\/g, '/'))}

try:
    L.login(username, password)
    L.save_session_to_file(session_file)
    print(json.dumps({"success": True}))
except instaloader.exceptions.BadCredentialsException:
    print(json.dumps({"error": "bad_credentials"}))
except instaloader.exceptions.TwoFactorAuthRequiredException:
    print(json.dumps({"error": "2fa_required"}))
except instaloader.exceptions.ConnectionException as e:
    msg = str(e)
    if "checkpoint" in msg.lower() or "challenge" in msg.lower():
        print(json.dumps({"error": "checkpoint"}))
    else:
        print(json.dumps({"error": f"connection: {msg}"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

    writeFileSync(tmpScript, pythonScript, 'utf-8');

    try {
      const { stdout, stderr } = await execAsync(`python "${tmpScript}"`, {
        timeout: 60000,
        maxBuffer: 1024 * 1024,
      });

      // Clean up temp script
      try { unlinkSync(tmpScript); } catch {}

      console.log('[Instagram Login] stdout:', stdout.trim());
      if (stderr) console.log('[Instagram Login] stderr:', stderr.substring(0, 200));

      const result = JSON.parse(stdout.trim());

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: `Login realizado com sucesso para @${username}`,
        });
      }

      const errorMap: Record<string, { message: string; status: number }> = {
        'bad_credentials': { message: 'Usuario ou senha incorretos', status: 401 },
        '2fa_required': { message: 'Conta com autenticacao de dois fatores (2FA). Use a opcao de importar cookies.', status: 400 },
        'checkpoint': { message: 'Instagram solicitou verificacao de seguranca. Acesse o Instagram pelo navegador, resolva a verificacao e tente novamente.', status: 400 },
      };

      const mapped = errorMap[result.error];
      if (mapped) {
        return NextResponse.json(
          { success: false, error: mapped.message },
          { status: mapped.status }
        );
      }

      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao fazer login' },
        { status: 500 }
      );

    } catch (execError: unknown) {
      // Clean up temp script
      try { unlinkSync(tmpScript); } catch {}

      const errorMsg = execError instanceof Error ? execError.message : '';
      console.error('[Instagram Login] exec error:', errorMsg);

      // Try to parse output from error
      try {
        const match = errorMsg.match(/\{.*\}/);
        if (match) {
          const result = JSON.parse(match[0]);
          if (result.error === 'bad_credentials') {
            return NextResponse.json({ success: false, error: 'Usuario ou senha incorretos' }, { status: 401 });
          }
          if (result.error === '2fa_required') {
            return NextResponse.json({ success: false, error: 'Conta com 2FA. Use importar cookies.' }, { status: 400 });
          }
        }
      } catch {}

      return NextResponse.json(
        { success: false, error: 'Erro de conexao. Verifique sua internet e tente novamente.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Instagram Login] request error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}
