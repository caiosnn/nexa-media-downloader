import { NextRequest, NextResponse } from 'next/server';
import { generateCaptcha, validateCaptcha } from '@/lib/captcha';

export const runtime = 'nodejs';

/**
 * GET /api/captcha - Generate a new captcha
 */
export async function GET(): Promise<NextResponse> {
  try {
    const captcha = generateCaptcha();

    return NextResponse.json({
      success: true,
      token: captcha.token,
      question: captcha.question,
      expiresIn: captcha.expiresIn,
    });
  } catch (error) {
    console.error('Error generating captcha:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao gerar captcha' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/captcha - Validate a captcha response
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { token, answer } = body;

    if (!token || answer === undefined || answer === null) {
      return NextResponse.json(
        { success: false, error: 'Token e resposta sao obrigatorios' },
        { status: 400 }
      );
    }

    const result = validateCaptcha(token, answer);

    if (result.valid) {
      return NextResponse.json({
        success: true,
        message: 'Captcha validado com sucesso',
      });
    }

    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error validating captcha:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao validar captcha' },
      { status: 500 }
    );
  }
}
