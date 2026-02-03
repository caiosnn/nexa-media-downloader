'use client';

import { useState, useRef, useEffect } from 'react';
import { Link, Download, Loader2, Check, X, ArrowRight, Zap, Play, Image as ImageIcon, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { PlatformIcon } from '@/components/platform-icon';
import { CaptchaDialog } from '@/components/captcha-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { detectPlatform, getPlatformName, isValidUrl, extractUsernameFromUrl } from '@/lib/platform-detector';
import { DownloadProgress, DownloadHistoryItem, Story } from '@/types';
import { toast } from 'sonner';
import { formatDistanceToNow } from '@/lib/utils';

interface ProfileUserInfo {
  id: string;
  username: string;
  displayName: string;
  profilePicUrl: string;
  isPrivate: boolean;
}

interface ProfileResult {
  user: ProfileUserInfo;
  stories: Story[];
}

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
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(null);
  const [downloadingStoryId, setDownloadingStoryId] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isRefreshingStories, setIsRefreshingStories] = useState(false);
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

    // Handle Instagram profile URLs — fetch stories instead of downloading
    if (detection.contentType === 'profile') {
      const username = extractUsernameFromUrl(url);
      if (!username) {
        setDownloadState({ status: 'error', progress: 0, message: 'Nao foi possivel extrair o username do link.' });
        return;
      }

      setDownloadState({
        status: 'downloading',
        progress: 30,
        message: `Buscando stories de @${username}...`,
        platform: 'instagram',
        contentType: 'profile',
      });

      try {
        const res = await fetch(`/api/instagram/stories?username=${encodeURIComponent(username)}`);
        const data = await res.json();

        if (!data.success) {
          setDownloadState({ status: 'error', progress: 0, message: data.error || 'Erro ao buscar stories' });
          return;
        }

        setProfileResult({ user: data.user, stories: data.stories || [] });

        setDownloadState({
          status: 'completed',
          progress: 100,
          message: data.stories?.length
            ? `${data.stories.length} stories encontrados!`
            : 'Nenhum story ativo no momento',
          platform: 'instagram',
          contentType: 'profile',
        });
      } catch {
        setDownloadState({ status: 'error', progress: 0, message: 'Erro de conexao. Tente novamente.' });
      }
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
    setProfileResult(null);
  };

  const handleDownloadStory = async (story: Story) => {
    if (!profileResult) return;
    setDownloadingStoryId(story.id);
    try {
      const res = await fetch('/api/instagram/stories/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: profileResult.user.username, storyId: story.id }),
      });
      const data = await res.json();
      if (data.success && data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.fileName || 'story.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Story baixado!');

        if (onDownloadComplete) {
          onDownloadComplete({
            id: Date.now().toString(),
            url: story.mediaUrl,
            platform: 'instagram',
            contentType: 'story',
            fileName: data.fileName,
            fileSize: data.fileSize || 0,
            downloadedAt: new Date().toISOString(),
            thumbnailUrl: story.thumbnailUrl,
          });
        }
      } else {
        toast.error(data.error || 'Erro ao baixar story');
      }
    } catch {
      toast.error('Erro ao baixar story');
    }
    setDownloadingStoryId(null);
  };

  const handleDownloadAllStories = async () => {
    if (!profileResult?.stories.length) return;
    setIsDownloadingAll(true);
    let downloaded = 0;

    for (const story of profileResult.stories) {
      try {
        const res = await fetch('/api/instagram/stories/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: profileResult.user.username, storyId: story.id }),
        });
        const data = await res.json();
        if (data.success && data.downloadUrl) {
          const link = document.createElement('a');
          link.href = data.downloadUrl;
          link.download = data.fileName || 'story.mp4';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          downloaded++;
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch {
        console.error('Failed to download story');
      }
    }

    toast.success(`${downloaded} stories baixados`);
    setIsDownloadingAll(false);
  };

  const handleRefreshStories = async () => {
    if (!profileResult) return;
    setIsRefreshingStories(true);
    try {
      const res = await fetch(
        `/api/instagram/stories?username=${encodeURIComponent(profileResult.user.username)}&refresh=true`
      );
      const data = await res.json();
      if (data.success) {
        setProfileResult({ user: data.user || profileResult.user, stories: data.stories || [] });
        toast.success(
          data.stories?.length
            ? `${data.stories.length} stories atualizados`
            : 'Nenhum story ativo'
        );
      } else {
        toast.error(data.error || 'Erro ao atualizar');
      }
    } catch {
      toast.error('Erro ao atualizar stories');
    }
    setIsRefreshingStories(false);
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

                {/* Success Actions (non-profile downloads only) */}
                {downloadState.status === 'completed' && !profileResult && (
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

            {/* Profile Stories Preview */}
            {profileResult && (
              <div className="mt-6 rounded-xl bg-background/50 border border-border/50 p-5 space-y-5">
                {/* Profile Header */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {profileResult.stories.length > 0 && (
                      <div className="absolute -inset-1 rounded-full gradient-primary opacity-80" />
                    )}
                    <Avatar className="relative h-16 w-16 border-2 border-background">
                      <AvatarImage
                        src={profileResult.user.profilePicUrl}
                        alt={profileResult.user.displayName}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground font-medium text-xl">
                        {profileResult.user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xl text-foreground truncate">
                      @{profileResult.user.username}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {profileResult.user.displayName}
                      {profileResult.stories.length > 0 && (
                        <span className="ml-2 text-primary font-medium">
                          &middot; {profileResult.stories.length} {profileResult.stories.length === 1 ? 'story' : 'stories'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleRefreshStories}
                      disabled={isRefreshingStories || isDownloadingAll}
                      className="glass-subtle border-white/10 hover:bg-white/5 h-10 w-10"
                      title="Atualizar stories"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshingStories ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetState}
                      className="glass-subtle border-white/10 hover:bg-white/5"
                    >
                      Buscar outro
                    </Button>
                  </div>
                </div>

                {/* Stories Grid */}
                {profileResult.stories.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {profileResult.stories.map((story) => (
                        <button
                          key={story.id}
                          onClick={() => handleDownloadStory(story)}
                          disabled={downloadingStoryId === story.id || isDownloadingAll}
                          className="relative aspect-[9/16] rounded-xl overflow-hidden border border-border/50 hover:border-primary/50 hover:scale-[1.02] transition-all group/story bg-muted/30"
                        >
                          {/* Thumbnail */}
                          {story.thumbnailUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={story.thumbnailUrl}
                              alt="Story"
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          {/* Fallback placeholder (shown if no thumbnail or on error) */}
                          <div
                            className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted/40 to-primary/10 items-center justify-center"
                            style={{ display: story.thumbnailUrl ? 'none' : 'flex' }}
                          >
                            {story.mediaType === 'video' ? (
                              <Play className="h-10 w-10 text-white/40" />
                            ) : (
                              <ImageIcon className="h-10 w-10 text-white/40" />
                            )}
                          </div>

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover/story:bg-black/40 transition-all flex items-center justify-center">
                            <div className="opacity-0 group-hover/story:opacity-100 transition-opacity flex flex-col items-center gap-1.5">
                              {downloadingStoryId === story.id ? (
                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                              ) : (
                                <>
                                  <Download className="h-8 w-8 text-white" />
                                  <span className="text-xs text-white/90 font-medium">Baixar</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Media Type Badge */}
                          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/60 flex items-center gap-1">
                            {story.mediaType === 'video' ? (
                              <Play className="h-3 w-3 text-white fill-white" />
                            ) : (
                              <ImageIcon className="h-3 w-3 text-white" />
                            )}
                            <span className="text-[10px] text-white font-medium uppercase">
                              {story.mediaType === 'video' ? 'Video' : 'Foto'}
                            </span>
                          </div>

                          {/* Time Badge */}
                          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/60">
                            <Clock className="h-3 w-3 text-white/80" />
                            <span className="text-[11px] text-white/90">
                              {formatDistanceToNow(story.postedAt)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Download All */}
                    <Button
                      onClick={handleDownloadAllStories}
                      disabled={isDownloadingAll}
                      size="lg"
                      className="w-full gradient-primary hover:opacity-90 gap-2 shadow-glow-sm transition-all text-base"
                    >
                      {isDownloadingAll ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Baixando stories...
                        </>
                      ) : (
                        <>
                          <Download className="h-5 w-5" />
                          Baixar todos ({profileResult.stories.length} stories)
                        </>
                      )}
                    </Button>

                  </>
                ) : (
                  <div className="py-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-3">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground text-lg">
                      {profileResult.user.isPrivate
                        ? 'Perfil privado - nao e possivel ver stories'
                        : 'Nenhum story ativo no momento'}
                    </p>
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
