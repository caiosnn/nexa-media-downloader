'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Header } from '@/components/header';
import { DownloadSection } from '@/components/download-section';
import { StorySearchSection } from '@/components/story-search-section';
import { InfluencerSection } from '@/components/influencer-section';
import { HistorySection } from '@/components/history-section';
import { InstagramStatus, InfluencerWithStories, DownloadHistoryItem, Story } from '@/types';

export default function HomePage() {
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus>({
    connected: false,
    lastChecked: new Date().toISOString(),
  });
  const [influencers, setInfluencers] = useState<InfluencerWithStories[]>([]);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);

  // Fetch Instagram status on mount
  useEffect(() => {
    fetchInstagramStatus();
  }, []);

  const fetchInstagramStatus = async () => {
    try {
      const res = await fetch('/api/instagram/status');
      const data = await res.json();
      setInstagramStatus({
        connected: data.connected,
        username: data.username,
        lastChecked: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to fetch Instagram status:', error);
    }
  };

  const handleRefreshSession = async () => {
    setIsRefreshingSession(true);
    await fetchInstagramStatus();
    setIsRefreshingSession(false);
  };

  const handleStatusChange = (status: { connected: boolean; username?: string }) => {
    setInstagramStatus({
      connected: status.connected,
      username: status.username,
      lastChecked: new Date().toISOString(),
    });
  };

  const handleAddInfluencer = async (username: string) => {
    const res = await fetch(`/api/instagram/stories?username=${encodeURIComponent(username)}`);
    const data = await res.json();

    if (!data.success) {
      toast.error(data.error || 'Erro ao buscar perfil');
      throw new Error(data.error);
    }

    const newInfluencer: InfluencerWithStories = {
      id: data.user?.id || Date.now().toString(),
      username: data.user?.username || username,
      displayName: data.user?.displayName || username,
      profilePicUrl: data.user?.profilePicUrl || '',
      isPrivate: data.user?.isPrivate || false,
      createdAt: new Date().toISOString(),
      stories: (data.stories || []).map((s: Story & { influencerId?: string }) => ({
        ...s,
        influencerId: data.user?.id || username,
      })),
      hasNewStories: (data.stories?.length || 0) > 0,
    };
    setInfluencers((prev) => [...prev, newInfluencer]);
  };

  const handleRemoveInfluencer = async (id: string) => {
    setInfluencers((prev) => prev.filter((i) => i.id !== id));
  };

  const handleRefreshStories = async () => {
    const updated = await Promise.all(
      influencers.map(async (inf) => {
        try {
          const res = await fetch(`/api/instagram/stories?username=${encodeURIComponent(inf.username)}`);
          const data = await res.json();
          if (data.success && data.stories) {
            return {
              ...inf,
              stories: data.stories.map((s: Story & { influencerId?: string }) => ({
                ...s,
                influencerId: inf.id,
              })),
              hasNewStories: data.stories.length > 0,
            };
          }
        } catch (e) {
          console.error(`Failed to refresh stories for @${inf.username}`, e);
        }
        return inf;
      })
    );
    setInfluencers(updated);
  };

  const handleAddToWatchlist = (username: string, prefetchedData?: { user: { id: string; username: string; displayName: string; profilePicUrl: string; isPrivate: boolean }; stories: Story[] }) => {
    if (influencers.some((i) => i.username === username)) {
      toast.error('Perfil ja esta na lista');
      return;
    }
    if (prefetchedData) {
      const newInfluencer: InfluencerWithStories = {
        id: prefetchedData.user.id,
        username: prefetchedData.user.username,
        displayName: prefetchedData.user.displayName,
        profilePicUrl: prefetchedData.user.profilePicUrl,
        isPrivate: prefetchedData.user.isPrivate,
        createdAt: new Date().toISOString(),
        stories: prefetchedData.stories.map((s) => ({ ...s, influencerId: prefetchedData.user.id })),
        hasNewStories: prefetchedData.stories.length > 0,
      };
      setInfluencers((prev) => [...prev, newInfluencer]);
      toast.success(`@${username} adicionado ao monitor`);
    } else {
      handleAddInfluencer(username);
    }
  };

  const handleDownloadComplete = (item: DownloadHistoryItem) => {
    setHistory((prev) => [item, ...prev].slice(0, 100));
  };

  return (
    <div className="min-h-screen">
      <Header
        instagramStatus={instagramStatus}
        onRefreshSession={handleRefreshSession}
        isRefreshing={isRefreshingSession}
        onStatusChange={handleStatusChange}
      />

      <main className="container mx-auto px-4 py-10 md:px-8 lg:px-12">
        {/* Hero Download Section */}
        <div className="mb-16">
          <DownloadSection onDownloadComplete={handleDownloadComplete} />
        </div>

        {/* Story Search */}
        <div className="mb-16">
          <StorySearchSection
            onAddToWatchlist={handleAddToWatchlist}
            onDownloadComplete={handleDownloadComplete}
          />
        </div>

        {/* Content Grid */}
        <div className="space-y-16">
          {/* Influencers Section */}
          <InfluencerSection
            influencers={influencers}
            instagramConnected={instagramStatus.connected}
            onAddInfluencer={handleAddInfluencer}
            onRemoveInfluencer={handleRemoveInfluencer}
            onRefreshStories={handleRefreshStories}
          />

          {/* History Section */}
          <HistorySection history={history} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-border/50">
        <div className="container mx-auto px-4 py-8 md:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Media Downloader &middot; Partido Liberal
            </p>
            <p className="text-xs text-muted-foreground/60">
              Ferramenta interna de uso exclusivo
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
