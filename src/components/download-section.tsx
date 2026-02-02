'use client';

import { useState, useRef, useEffect } from 'react';
import { Link, Download, Loader2, Check, X, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { PlatformIcon } from '@/components/platform-icon';
import { CaptchaDialog } from '@/components/captcha-dialog';
import { detectPlatform, getPlatformName, isValidUrl } from '@/lib/platform-detector';
import { DownloadProgress, DownloadHistoryItem } from '@/types';

interface DownloadSectionProps {
  onDownloadComplete?: (item: DownloadHistoryItem) => void;
}

export function DownloadSection({ onDownloadComplete }: DownloadSectionProps) {
  const [url, setUrl] = useState('');
  const [downloadState, setDownloadState] = useState<DownloadProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [pendingCaptcha, setPendingCaptcha] = useState<{ token: string; answer: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Auto-focus input on mount
    inputRef.current?.focus();
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleDownload = async (captchaData?: { token: string; answer: string }) => {
    if (!url.trim()) {
      setDownloadState({
        status: 'error',
        progress: 0,
        message: 'Cole um link para comecar',
      });
      return;
    }

    if (!isValidUrl(url)) {
      setDownloadState({
        status: 'error',
        progress: 0,
        message: 'URL invalida. Verifique o link e tente novamente.',
      });
      return;
    }

    // Detect platform
    setDownloadState({
      status: 'detecting',
      progress: 10,
      message: 'Detectando plataforma...',
    });

    const detection = detectPlatform(url);

    if (!detection.isValid) {
      setDownloadState({
        status: 'error',
        progress: 0,
        message: 'Plataforma nao suportada. Use links do YouTube, Instagram ou X.',
      });
      return;
    }

    setDownloadState({
      status: 'downloading',
      progress: 20,
      message: `Baixando de ${getPlatformName(detection.platform)}...`,
      platform: detection.platform,
      contentType: detection.contentType,
    });

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Build request body
      const requestBody: Record<string, unknown> = { url };
      if (captchaData) {
        requestBody.captchaToken = captchaData.token;
        requestBody.captchaAnswer = captchaData.answer;
      }

      // Start progress simulation
      const progressInterval = setInterval(() => {
        setDownloadState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 5, 85),
        }));
      }, 1000);

      // Call the download API with timeout
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 120000); // 2 minute timeout

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);
      clearInterval(progressInterval);

      const data = await response.json();

      // Handle rate limit with captcha
      if (response.status === 429 && data.requireCaptcha) {
        setShowCaptcha(true);
        setDownloadState({
          status: 'error',
          progress: 0,
          message: 'Limite de requisicoes atingido. Resolva o captcha para continuar.',
          platform: detection.platform,
          contentType: detection.contentType,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao baixar');
      }

      if (data.success) {
        setDownloadState({
          status: 'completed',
          progress: 100,
          message: 'Download concluido!',
          platform: detection.platform,
          contentType: detection.contentType,
          fileName: data.fileName,
          fileSize: data.fileSize,
          downloadUrl: data.downloadUrl,
        });

        // Add to history
        if (onDownloadComplete) {
          onDownloadComplete({
            id: Date.now().toString(),
            url,
            platform: detection.platform,
            contentType: detection.contentType,
            fileName: data.fileName || 'video.mp4',
            fileSize: data.fileSize || 0,
            downloadedAt: new Date().toISOString(),
          });
        }

        // Clear URL after successful download
        setUrl('');
        // Clear pending captcha
        setPendingCaptcha(null);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setDownloadState({
          status: 'error',
          progress: 0,
          message: 'Download cancelado ou tempo esgotado. Tente novamente.',
          platform: detection.platform,
          contentType: detection.contentType,
        });
      } else {
        setDownloadState({
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'Erro ao baixar. Tente novamente.',
          platform: detection.platform,
          contentType: detection.contentType,
        });
      }
    }
  };

  const handleCaptchaSuccess = (token: string, answer: string) => {
    setPendingCaptcha({ token, answer });
    setShowCaptcha(false);
    // Retry download with captcha
    handleDownload({ token, answer });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && downloadState.status !== 'downloading' && downloadState.status !== 'detecting') {
      handleDownload();
    }
  };

  const handleSaveFile = () => {
    if (downloadState.downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadState.downloadUrl;
      link.download = downloadState.fileName || 'download.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const resetState = () => {
    setDownloadState({
      status: 'idle',
      progress: 0,
      message: '',
    });
    setPendingCaptcha(null);
  };

  const isProcessing = downloadState.status === 'detecting' || downloadState.status === 'downloading';

  return (
    <section className="relative">
      {/* Captcha Dialog */}
      <CaptchaDialog
        open={showCaptcha}
        onOpenChange={setShowCaptcha}
        onSuccess={handleCaptchaSuccess}
      />

      {/* Background decorations */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 left-1/4 w-[300px] h-[300px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative space-y-8">
        {/* Hero Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" />
            <span>Download rapido e seguro</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
            Baixe midias de
            <span className="text-gradient-primary"> qualquer lugar</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Cole um link do YouTube, Instagram ou X e baixe instantaneamente
          </p>
        </div>

        {/* Download Card */}
        <div className="relative max-w-3xl mx-auto">
          {/* Card glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-2xl blur-xl opacity-50" />

          <div className="relative glass-card rounded-2xl p-8 shadow-card">
            {/* Input Area */}
            <div className="flex gap-4">
              <div className="relative flex-1 group">
                {/* Input glow on focus */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary/30 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center">
                  <div className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <Link className="h-5 w-5 text-primary" />
                  </div>
                  <Input
                    ref={inputRef}
                    type="url"
                    placeholder="Cole o link aqui..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isProcessing}
                    className="pl-16 pr-4 h-14 text-base glass-input rounded-xl border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
              <Button
                onClick={() => handleDownload()}
                disabled={isProcessing || !url.trim()}
                className="h-14 px-8 gradient-primary hover:opacity-90 text-white font-semibold rounded-xl shadow-glow-sm hover:shadow-glow transition-all gap-2 group"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="hidden sm:inline">Processando</span>
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    <span className="hidden sm:inline">Baixar</span>
                    <ArrowRight className="h-4 w-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                  </>
                )}
              </Button>
            </div>

            {/* Feedback Area */}
            {downloadState.status !== 'idle' && (
              <div className="mt-6 rounded-xl bg-background/50 border border-border/50 p-5 space-y-4">
                {/* Status Header */}
                <div className="flex items-center gap-4">
                  {downloadState.status === 'detecting' && (
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                  {downloadState.status === 'downloading' && downloadState.platform && (
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <PlatformIcon platform={downloadState.platform} size={22} />
                    </div>
                  )}
                  {downloadState.status === 'completed' && (
                    <div className="h-10 w-10 rounded-xl gradient-success flex items-center justify-center shadow-glow-success">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                  )}
                  {downloadState.status === 'error' && (
                    <div className="h-10 w-10 rounded-xl bg-destructive flex items-center justify-center">
                      <X className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {downloadState.message}
                    </p>
                    {downloadState.status === 'completed' && downloadState.fileName && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {downloadState.fileName}
                        {downloadState.fileSize && (
                          <span className="ml-2 text-muted-foreground/60">
                            ({(downloadState.fileSize / 1024 / 1024).toFixed(1)} MB)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {(downloadState.status === 'detecting' || downloadState.status === 'downloading') && (
                  <div className="space-y-2">
                    <Progress value={downloadState.progress} className="h-2 bg-background" />
                    <p className="text-xs text-muted-foreground text-right">
                      {downloadState.progress}%
                    </p>
                  </div>
                )}

                {/* Success Actions */}
                {downloadState.status === 'completed' && (
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={handleSaveFile}
                      className="gradient-primary hover:opacity-90 gap-2 shadow-glow-sm"
                    >
                      <Download className="h-4 w-4" />
                      Salvar arquivo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetState}
                      className="glass-subtle border-white/10 hover:bg-white/5"
                    >
                      Baixar outro
                    </Button>
                  </div>
                )}

                {/* Error Actions */}
                {downloadState.status === 'error' && (
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={resetState}
                      className="glass-subtle border-white/10 hover:bg-white/5"
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Supported Platforms */}
            <div className="mt-8 pt-6 border-t border-border/50">
              <p className="text-xs text-muted-foreground/60 text-center mb-4 uppercase tracking-wider font-medium">
                Plataformas suportadas
              </p>
              <div className="flex items-center justify-center gap-8">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl glass-subtle hover:bg-white/5 transition-colors cursor-default group">
                  <PlatformIcon platform="youtube" size={20} />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">YouTube</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl glass-subtle hover:bg-white/5 transition-colors cursor-default group">
                  <PlatformIcon platform="instagram" size={20} />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Instagram</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl glass-subtle hover:bg-white/5 transition-colors cursor-default group">
                  <PlatformIcon platform="twitter" size={20} />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">X / Twitter</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
