'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { DownloadSection } from '@/components/download-section';
import { InfluencerSection } from '@/components/influencer-section';
import { HistorySection } from '@/components/history-section';
import { InstagramStatus, InfluencerWithStories, DownloadHistoryItem } from '@/types';

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
    // TODO: Implement actual API call
    const newInfluencer: InfluencerWithStories = {
      id: Date.now().toString(),
      username,
      displayName: username,
      profilePicUrl: `https://picsum.photos/seed/${username}/100/100`,
      isPrivate: false,
      createdAt: new Date().toISOString(),
      stories: [],
      hasNewStories: false,
    };
    setInfluencers((prev) => [...prev, newInfluencer]);
  };

  const handleRemoveInfluencer = async (id: string) => {
    setInfluencers((prev) => prev.filter((i) => i.id !== id));
  };

  const handleRefreshStories = async () => {
    // TODO: Implement actual API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
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
