'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Shield, RefreshCw } from 'lucide-react';

interface CaptchaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (token: string, answer: string) => void;
}

interface CaptchaData {
  token: string;
  question: string;
  expiresIn: number;
}

export function CaptchaDialog({ open, onOpenChange, onSuccess }: CaptchaDialogProps) {
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Fetch captcha when dialog opens
  useEffect(() => {
    if (open) {
      fetchCaptcha();
    } else {
      // Reset state when closed
      setCaptcha(null);
      setAnswer('');
      setError(null);
      setTimeLeft(0);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && captcha) {
      setError('Captcha expirado. Clique em atualizar.');
    }
  }, [timeLeft, captcha]);

  const fetchCaptcha = async () => {
    setLoading(true);
    setError(null);
    setAnswer('');

    try {
      const response = await fetch('/api/captcha');
      const data = await response.json();

      if (data.success) {
        setCaptcha({
          token: data.token,
          question: data.question,
          expiresIn: data.expiresIn,
        });
        setTimeLeft(data.expiresIn);
      } else {
        setError(data.error || 'Erro ao carregar captcha');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captcha || !answer.trim()) {
      setError('Digite a resposta');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: captcha.token,
          answer: answer.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(captcha.token, answer.trim());
        onOpenChange(false);
      } else {
        setError(data.error || 'Resposta incorreta');
        // Refresh captcha on wrong answer
        fetchCaptcha();
      }
    } catch (err) {
      setError('Erro ao validar captcha');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Verificacao de Seguranca
          </DialogTitle>
          <DialogDescription>
            Resolva o captcha para continuar. Isso ajuda a proteger o servico.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {loading && !captcha ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : captcha ? (
            <>
              {/* Captcha Question */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pergunta:</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${timeLeft < 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {formatTime(timeLeft)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={fetchCaptcha}
                      disabled={loading}
                      className="h-8 w-8 p-0"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg bg-primary/10 p-4 text-center">
                  <span className="text-2xl font-bold text-primary">
                    {captcha.question}
                  </span>
                </div>
              </div>

              {/* Answer Input */}
              <div className="space-y-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Digite a resposta"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={loading || timeLeft === 0}
                  autoFocus
                  className="text-center text-lg"
                />
              </div>

              {/* Error Message */}
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              {/* Submit Button */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !answer.trim() || timeLeft === 0}
                  className="flex-1 gradient-primary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verificando...
                    </>
                  ) : (
                    'Verificar'
                  )}
                </Button>
              </div>
            </>
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={fetchCaptcha} variant="outline">
                Tentar novamente
              </Button>
            </div>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
