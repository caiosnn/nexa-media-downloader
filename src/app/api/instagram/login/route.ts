import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export const runtime = 'nodejs';

const INSTALOADER_PATH = 'C:\\Users\\User\\AppData\\Roaming\\Python\\Python314\\Scripts\\instaloader.exe';
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

    // Use instaloader to login and save session
    // The session file will be saved in the session directory
    const sessionFile = path.join(SESSION_DIR, `session-${username}`);

    // Create a Python script to handle login securely
    const pythonScript = `
import instaloader
import sys

L = instaloader.Instaloader(
    dirname_pattern="${SESSION_DIR.replace(/\\/g, '\\\\')}",
    save_metadata=False,
    download_comments=False,
    download_geotags=False,
    download_pictures=True,
    download_videos=True,
    download_video_thumbnails=False,
    compress_json=False
)

try:
    L.login("${username}", "${password.replace(/"/g, '\\"')}")
    L.save_session_to_file("${sessionFile.replace(/\\/g, '\\\\')}")
    print("LOGIN_SUCCESS")
except instaloader.exceptions.BadCredentialsException:
    print("BAD_CREDENTIALS")
    sys.exit(1)
except instaloader.exceptions.TwoFactorAuthRequiredException:
    print("2FA_REQUIRED")
    sys.exit(2)
except instaloader.exceptions.ConnectionException as e:
    print(f"CONNECTION_ERROR: {e}")
    sys.exit(3)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(4)
`;

    const command = `python -c "${pythonScript.replace(/\n/g, ';').replace(/"/g, '\\"')}"`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000,
        maxBuffer: 1024 * 1024,
      });

      console.log('Login stdout:', stdout);
      console.log('Login stderr:', stderr);

      if (stdout.includes('LOGIN_SUCCESS')) {
        return NextResponse.json({
          success: true,
          message: `Login realizado com sucesso para @${username}`,
        });
      }

      if (stdout.includes('BAD_CREDENTIALS')) {
        return NextResponse.json(
          { success: false, error: 'Usuario ou senha incorretos' },
          { status: 401 }
        );
      }

      if (stdout.includes('2FA_REQUIRED')) {
        return NextResponse.json(
          { success: false, error: 'Conta com autenticacao de dois fatores. Desative temporariamente ou use cookies.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Erro ao fazer login. Tente novamente.' },
        { status: 500 }
      );

    } catch (execError: unknown) {
      const errorMsg = execError instanceof Error ? execError.message : '';
      console.error('Login exec error:', errorMsg);

      if (errorMsg.includes('BAD_CREDENTIALS') || errorMsg.includes('bad_password')) {
        return NextResponse.json(
          { success: false, error: 'Usuario ou senha incorretos' },
          { status: 401 }
        );
      }

      if (errorMsg.includes('2FA_REQUIRED') || errorMsg.includes('two_factor')) {
        return NextResponse.json(
          { success: false, error: 'Conta com autenticacao de dois fatores. Use a opcao de importar cookies.' },
          { status: 400 }
        );
      }

      if (errorMsg.includes('checkpoint') || errorMsg.includes('challenge')) {
        return NextResponse.json(
          { success: false, error: 'Instagram solicitou verificacao de seguranca. Acesse o Instagram pelo navegador, resolva a verificacao e tente novamente.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Erro de conexao. Verifique sua internet e tente novamente.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Login request error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}
