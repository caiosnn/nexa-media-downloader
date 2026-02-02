'use client';

import Image from 'next/image';
import Link from 'next/link';
import { RefreshCw, Sparkles, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstagramSettingsDialog } from '@/components/instagram-settings-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InstagramStatus } from '@/types';

interface HeaderProps {
  instagramStatus: InstagramStatus;
  onRefreshSession?: () => void;
  isRefreshing?: boolean;
  onStatusChange?: (status: { connected: boolean; username?: string }) => void;
}

export function Header({ instagramStatus, onRefreshSession, isRefreshing, onStatusChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Glass background */}
      <div className="absolute inset-0 glass border-b border-border/50" />

      {/* Gradient accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="relative container mx-auto flex h-18 items-center justify-between px-4 md:px-8 lg:px-12">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {/* Logo glow effect */}
            <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full opacity-50" />
            <Image
              src="/logo-pl.svg"
              alt="Partido Liberal"
              width={44}
              height={48}
              className="relative h-11 w-auto drop-shadow-lg"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-foreground tracking-tight">
                Media Downloader
              </span>
              <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Pro</span>
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-medium hidden sm:block">
              Partido Liberal
            </span>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Instagram Status */}
          {instagramStatus.connected ? (
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full glass-subtle">
              <div className="relative">
                <div className="h-2.5 w-2.5 rounded-full status-online" />
                <div className="absolute inset-0 h-2.5 w-2.5 rounded-full status-online animate-ping opacity-75" />
              </div>
              <span className="text-sm font-medium text-success hidden sm:inline">
                Instagram conectado
              </span>
              <span className="text-sm font-medium text-success sm:hidden">
                Online
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20">
                <div className="h-2.5 w-2.5 rounded-full status-offline" />
                <span className="text-sm font-medium text-destructive hidden sm:inline">
                  Nao conectado
                </span>
                <span className="text-sm font-medium text-destructive sm:hidden">
                  Offline
                </span>
              </div>
              {onRefreshSession && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefreshSession}
                  disabled={isRefreshing}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          )}

          {/* API Settings Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Configuracoes de API</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Instagram Settings Button */}
          <InstagramSettingsDialog onStatusChange={onStatusChange} />
        </div>
      </div>
    </header>
  );
}
