/**
 * Simple Captcha System
 * Generates math-based captchas and validates responses
 */

import crypto from 'crypto';

// Store for captcha tokens (in production, use Redis or similar)
const captchaStore: Map<string, CaptchaEntry> = new Map();

interface CaptchaEntry {
  answer: number;
  expiresAt: number;
  used: boolean;
}

interface CaptchaChallenge {
  token: string;
  question: string;
  expiresIn: number; // seconds
}

interface CaptchaValidation {
  valid: boolean;
  error?: string;
}

// Configuration
const CAPTCHA_TTL = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

// Cleanup old captchas
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of captchaStore.entries()) {
    if (now > entry.expiresAt) {
      captchaStore.delete(token);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Generate a random math captcha
 */
function generateMathCaptcha(): { question: string; answer: number } {
  const operations = [
    { symbol: '+', fn: (a: number, b: number) => a + b },
    { symbol: '-', fn: (a: number, b: number) => a - b },
    { symbol: 'x', fn: (a: number, b: number) => a * b },
  ];

  const op = operations[Math.floor(Math.random() * operations.length)];
  let num1: number, num2: number;

  // Generate appropriate numbers based on operation
  if (op.symbol === 'x') {
    num1 = Math.floor(Math.random() * 10) + 1; // 1-10
    num2 = Math.floor(Math.random() * 10) + 1; // 1-10
  } else if (op.symbol === '-') {
    num1 = Math.floor(Math.random() * 50) + 10; // 10-59
    num2 = Math.floor(Math.random() * num1); // 0 to num1-1 (ensure positive result)
  } else {
    num1 = Math.floor(Math.random() * 50) + 1; // 1-50
    num2 = Math.floor(Math.random() * 50) + 1; // 1-50
  }

  return {
    question: `${num1} ${op.symbol} ${num2}`,
    answer: op.fn(num1, num2),
  };
}

/**
 * Generate a new captcha challenge
 */
export function generateCaptcha(): CaptchaChallenge {
  const { question, answer } = generateMathCaptcha();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + CAPTCHA_TTL;

  // Store the captcha
  captchaStore.set(token, {
    answer,
    expiresAt,
    used: false,
  });

  return {
    token,
    question: `Quanto e ${question}?`,
    expiresIn: Math.floor(CAPTCHA_TTL / 1000),
  };
}

/**
 * Validate a captcha response
 */
export function validateCaptcha(token: string, userAnswer: string | number): CaptchaValidation {
  const entry = captchaStore.get(token);

  // Check if token exists
  if (!entry) {
    return { valid: false, error: 'Captcha invalido ou expirado' };
  }

  // Check if already used
  if (entry.used) {
    captchaStore.delete(token);
    return { valid: false, error: 'Este captcha ja foi utilizado' };
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    captchaStore.delete(token);
    return { valid: false, error: 'Captcha expirado' };
  }

  // Parse user answer
  const parsedAnswer = typeof userAnswer === 'string'
    ? parseInt(userAnswer.trim(), 10)
    : userAnswer;

  if (isNaN(parsedAnswer)) {
    return { valid: false, error: 'Resposta invalida' };
  }

  // Validate answer
  if (parsedAnswer === entry.answer) {
    entry.used = true;
    captchaStore.delete(token); // Remove after successful use
    return { valid: true };
  }

  // Wrong answer - allow retry with same token
  return { valid: false, error: 'Resposta incorreta' };
}

/**
 * Check if a captcha token is still valid (not used, not expired)
 */
export function isCaptchaValid(token: string): boolean {
  const entry = captchaStore.get(token);
  if (!entry) return false;
  if (entry.used) return false;
  if (Date.now() > entry.expiresAt) return false;
  return true;
}

/**
 * Get remaining time for a captcha (in seconds)
 */
export function getCaptchaTimeRemaining(token: string): number {
  const entry = captchaStore.get(token);
  if (!entry) return 0;
  const remaining = entry.expiresAt - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}

// Export types
export type { CaptchaChallenge, CaptchaValidation };
