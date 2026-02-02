import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { testRapidAPIConnection } from '@/lib/instagram-rapidapi';

export const runtime = 'nodejs';

// Settings file path
const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

// Types
interface AppSettings {
  rapidApiKey: string;
  rapidApiEnabled: boolean;
  lastUpdated: string;
}

interface SettingsResponse {
  success: boolean;
  settings?: {
    rapidApiKey: string; // Masked key
    rapidApiEnabled: boolean;
    lastUpdated?: string;
    isConfigured: boolean;
  };
  error?: string;
}

interface TestResponse {
  success: boolean;
  error?: string;
}

/**
 * Mask API key for display (show first 4 and last 4 characters)
 */
function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '****';
  return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
}

/**
 * Load settings from file
 */
function loadSettings(): AppSettings | null {
  try {
    if (!existsSync(SETTINGS_FILE)) {
      return null;
    }
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content) as AppSettings;
  } catch (error) {
    console.error('[Settings] Error loading settings:', error);
    return null;
  }
}

/**
 * Save settings to file
 */
function saveSettings(settings: AppSettings): boolean {
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[Settings] Error saving settings:', error);
    return false;
  }
}

/**
 * GET /api/settings - Get current settings (with masked API key)
 */
export async function GET(): Promise<NextResponse<SettingsResponse>> {
  try {
    const settings = loadSettings();

    if (!settings) {
      return NextResponse.json({
        success: true,
        settings: {
          rapidApiKey: '',
          rapidApiEnabled: false,
          isConfigured: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        rapidApiKey: maskApiKey(settings.rapidApiKey),
        rapidApiEnabled: settings.rapidApiEnabled,
        lastUpdated: settings.lastUpdated,
        isConfigured: !!settings.rapidApiKey,
      },
    });
  } catch (error) {
    console.error('[Settings] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao carregar configuracoes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings - Save settings
 */
export async function POST(request: NextRequest): Promise<NextResponse<SettingsResponse>> {
  try {
    const body = await request.json();
    const { rapidApiKey, rapidApiEnabled } = body;

    // Validate
    if (rapidApiEnabled && !rapidApiKey) {
      return NextResponse.json(
        { success: false, error: 'API key e obrigatoria quando RapidAPI esta habilitado' },
        { status: 400 }
      );
    }

    // Load existing settings to preserve key if not changed
    const existingSettings = loadSettings();
    let finalApiKey = rapidApiKey;

    // If key looks masked (contains asterisks), use the existing key
    if (rapidApiKey && rapidApiKey.includes('*') && existingSettings?.rapidApiKey) {
      finalApiKey = existingSettings.rapidApiKey;
    }

    // Create new settings
    const newSettings: AppSettings = {
      rapidApiKey: finalApiKey || '',
      rapidApiEnabled: !!rapidApiEnabled,
      lastUpdated: new Date().toISOString(),
    };

    // Save settings
    const saved = saveSettings(newSettings);

    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar configuracoes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: {
        rapidApiKey: maskApiKey(newSettings.rapidApiKey),
        rapidApiEnabled: newSettings.rapidApiEnabled,
        lastUpdated: newSettings.lastUpdated,
        isConfigured: !!newSettings.rapidApiKey,
      },
    });
  } catch (error) {
    console.error('[Settings] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao salvar configuracoes' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings - Test API connection
 */
export async function PUT(request: NextRequest): Promise<NextResponse<TestResponse>> {
  try {
    const body = await request.json();
    let { apiKey } = body;

    // If key is masked, use existing key
    if (apiKey && apiKey.includes('*')) {
      const existingSettings = loadSettings();
      if (existingSettings?.rapidApiKey) {
        apiKey = existingSettings.rapidApiKey;
      } else {
        return NextResponse.json(
          { success: false, error: 'Insira uma nova API key para testar' },
          { status: 400 }
        );
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key e obrigatoria' },
        { status: 400 }
      );
    }

    // Test the connection
    const result = await testRapidAPIConnection(apiKey);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Settings] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao testar conexao' },
      { status: 500 }
    );
  }
}
