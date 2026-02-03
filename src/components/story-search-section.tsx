'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Search,
  Download,
  Loader2,
  Play,
  Image as ImageIcon,
  UserPlus,
  Instagram,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Story, DownloadHistoryItem } from '@/types';
import { formatDistanceToNow } from '@/lib/utils';

interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  profilePicUrl: string;
  isPrivate: boolean;
}

interface StorySearchSectionProps {
  onAddToWatchlist?: (
    username: string,
    prefetchedData?: { user: UserInfo; stories: Story[] }
  ) => void;
  onDownloadComplete?: (item: DownloadHistoryItem) => void;
}

export function StorySearchSection({
  onAddToWatchlist,
  onDownloadComplete,
}: StorySearchSectionProps) {
  const [username, setUsername] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    user: UserInfo;
    stories: Story[];
  } | null>(null);
  const [error, setError] = useState('');
  const [downloadingStoryId, setDownloadingStoryId] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return;

    if (!/^[a-zA-Z0-9._]+$/.test(clean)) {
      setError('Username invalido');
      return;
    }

    setError('');
    setIsSearching(true);
    setSearchResult(null);

    try {
      const res = await fetch(
        `/api/instagram/stories?username=${encodeURIComponent(clean)}`
      );
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Erro ao buscar stories');
        return;
      }

      setSearchResult({
        user: data.user,
        stories: data.stories || [],
      });
    } catch {
      setError('Erro de conexao. Tente novamente.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownloadStory = async (story: Story) => {
    setDownloadingStoryId(story.id);
    try {
      const res = await fetch('/api/instagram/stories/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: searchResult?.user.username,
          storyId: story.id,
        }),
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
            fileSize: data.fileSize,
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

  const handleDownloadAll = async () => {
    if (!searchResult?.stories.length) return;
    setIsDownloadingAll(true);
    let downloaded = 0;

    for (const story of searchResult.stories) {
      try {
        const res = await fetch('/api/instagram/stories/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: searchResult.user.username,
            storyId: story.id,
          }),
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

  const handleAddToWatchlist = () => {
    if (!searchResult || !onAddToWatchlist) return;
    onAddToWatchlist(searchResult.user.username, searchResult);
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-sm">
            <Instagram className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">
              Buscar Stories
            </h2>
            <p className="text-sm text-muted-foreground">
              Pesquise stories de qualquer perfil publico
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary/30 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative">
            <Input
              placeholder="Digite o username... ex: instagram"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              disabled={isSearching}
              className="h-12 glass-input rounded-xl border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 pl-4 transition-all"
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={isSearching || !username.trim()}
          className="h-12 px-6 gradient-primary hover:opacity-90 shadow-glow-sm gap-2 transition-all"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Buscar</span>
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl glass-subtle border border-destructive/30 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      {searchResult && (
        <div className="glass-card rounded-2xl p-6 shadow-card space-y-5">
          {/* Profile Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                {searchResult.stories.length > 0 && (
                  <div className="absolute -inset-1 rounded-full gradient-primary opacity-80" />
                )}
                <Avatar className="relative h-14 w-14 border-2 border-background">
                  <AvatarImage
                    src={searchResult.user.profilePicUrl}
                    alt={searchResult.user.displayName}
                  />
                  <AvatarFallback className="bg-muted text-muted-foreground font-medium text-lg">
                    {searchResult.user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <p className="font-semibold text-lg text-foreground">
                  @{searchResult.user.username}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchResult.user.displayName}
                  {searchResult.stories.length > 0 && (
                    <span className="ml-2 text-success">
                      &middot; {searchResult.stories.length} stories
                    </span>
                  )}
                </p>
              </div>
            </div>

            {onAddToWatchlist && (
              <Button
                variant="outline"
                onClick={handleAddToWatchlist}
                className="gap-2 glass-subtle border-white/10 hover:bg-white/5"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Monitorar</span>
              </Button>
            )}
          </div>

          {/* Stories Grid */}
          {searchResult.stories.length > 0 ? (
            <>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {searchResult.stories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => handleDownloadStory(story)}
                    disabled={
                      downloadingStoryId === story.id || isDownloadingAll
                    }
                    className="relative flex-shrink-0 h-32 w-20 rounded-xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all group/story"
                  >
                    {story.thumbnailUrl && (
                      <Image
                        src={story.thumbnailUrl}
                        alt="Story"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/story:opacity-100 transition-opacity flex items-center justify-center">
                      {downloadingStoryId === story.id ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      ) : (
                        <Download className="h-6 w-6 text-white" />
                      )}
                    </div>
                    {/* Media Type Badge */}
                    <div className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded-md bg-black/60 flex items-center justify-center">
                      {story.mediaType === 'video' ? (
                        <Play className="h-3 w-3 text-white" />
                      ) : (
                        <ImageIcon className="h-3 w-3 text-white" />
                      )}
                    </div>
                    {/* Time */}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/60">
                      <Clock className="h-2.5 w-2.5 text-white/80" />
                      <span className="text-[10px] text-white/80">
                        {formatDistanceToNow(story.postedAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Download All */}
              <Button
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                className="w-full gradient-primary hover:opacity-90 gap-2 shadow-glow-sm transition-all"
              >
                {isDownloadingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Baixando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Baixar todos ({searchResult.stories.length})
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="text-muted-foreground">
                {searchResult.user.isPrivate
                  ? 'Perfil privado - nao e possivel ver stories'
                  : 'Nenhum story ativo no momento'}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
