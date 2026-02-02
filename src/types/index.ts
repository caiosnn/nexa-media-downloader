// Platform types
export type Platform = 'youtube' | 'instagram' | 'twitter' | 'unknown';

export type ContentType = 'video' | 'reel' | 'story' | 'post' | 'short';

// Download types
export interface DownloadRequest {
  url: string;
  platform?: Platform;
}

export interface DownloadProgress {
  status: 'idle' | 'detecting' | 'downloading' | 'completed' | 'error';
  progress: number;
  message: string;
  platform?: Platform;
  contentType?: ContentType;
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string;
}

export interface DownloadHistoryItem {
  id: string;
  url: string;
  platform: Platform;
  contentType: ContentType;
  fileName: string;
  fileSize: number;
  downloadedAt: string;
  thumbnailUrl?: string;
}

// Influencer types
export interface Influencer {
  id: string;
  username: string;
  displayName: string;
  profilePicUrl: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface Story {
  id: string;
  influencerId: string;
  mediaUrl: string;
  thumbnailUrl: string;
  mediaType: 'image' | 'video';
  postedAt: string;
  expiresAt: string;
}

export interface InfluencerWithStories extends Influencer {
  stories: Story[];
  hasNewStories: boolean;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Instagram session status
export interface InstagramStatus {
  connected: boolean;
  username?: string;
  lastChecked: string;
}
