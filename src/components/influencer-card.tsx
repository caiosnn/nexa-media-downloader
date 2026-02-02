'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Download, Trash2, Play, Image as ImageIcon, Loader2, MoreHorizontal, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InfluencerWithStories, Story } from '@/types';
import { formatDistanceToNow } from '@/lib/utils';

interface InfluencerCardProps {
  influencer: InfluencerWithStories;
  onRemove: () => void;
  disabled?: boolean;
}

export function InfluencerCard({ influencer, onRemove, disabled }: InfluencerCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingStoryId, setDownloadingStoryId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasStories = influencer.stories.length > 0;

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    // TODO: Implement batch download
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsDownloading(false);
  };

  const handleDownloadStory = async (story: Story) => {
    setDownloadingStoryId(story.id);
    // TODO: Implement single story download
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setDownloadingStoryId(null);
  };

  return (
    <div
      className={`group relative glass-card rounded-2xl p-5 shadow-card hover-lift transition-all ${
        !hasStories ? 'opacity-70' : ''
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity gradient-border pointer-events-none" />

      {/* Profile Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* Avatar with ring */}
          <div className="relative">
            {hasStories && (
              <div className="absolute -inset-1 rounded-full gradient-primary opacity-80" />
            )}
            <Avatar className={`relative h-12 w-12 border-2 ${hasStories ? 'border-background' : 'border-border/50'}`}>
              <AvatarImage src={influencer.profilePicUrl} alt={influencer.displayName} />
              <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                {influencer.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {hasStories && (
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full status-online border-2 border-background" />
            )}
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">
              @{influencer.username}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {influencer.displayName}
            </p>
          </div>
        </div>

        {/* More Options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass shadow-dropdown">
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover perfil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stories Section */}
      {hasStories ? (
        <div className="space-y-4">
          {/* Stories Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full status-online" />
              <span className="text-sm font-medium text-foreground">
                {influencer.stories.length} {influencer.stories.length === 1 ? 'story' : 'stories'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(influencer.stories[0].postedAt)}
            </div>
          </div>

          {/* Story Thumbnails */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {influencer.stories.map((story) => (
              <button
                key={story.id}
                onClick={() => handleDownloadStory(story)}
                disabled={downloadingStoryId === story.id}
                className="relative flex-shrink-0 h-20 w-14 rounded-xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all group/story"
              >
                <Image
                  src={story.thumbnailUrl}
                  alt="Story thumbnail"
                  fill
                  className="object-cover"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/story:opacity-100 transition-opacity flex items-center justify-center">
                  {downloadingStoryId === story.id ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Download className="h-5 w-5 text-white" />
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
              </button>
            ))}
          </div>

          {/* Download All Button */}
          <Button
            onClick={handleDownloadAll}
            disabled={isDownloading}
            className="w-full gradient-primary hover:opacity-90 gap-2 shadow-glow-sm transition-all"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Baixando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Baixar todos
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-sm text-muted-foreground">Sem stories ativos</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="glass shadow-dropdown border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover influenciador?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">@{influencer.username}</span> sera removido da sua lista de monitoramento.
              Essa acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass-subtle border-white/10 hover:bg-white/5">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
