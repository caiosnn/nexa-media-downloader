import { Platform, ContentType } from '@/types';

interface DetectionResult {
  platform: Platform;
  contentType: ContentType;
  isValid: boolean;
}

// URL patterns for each platform
const PATTERNS = {
  youtube: {
    video: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    short: /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  },
  instagram: {
    post: /instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    reel: /instagram\.com\/reels?\/([a-zA-Z0-9_-]+)/,
    story: /instagram\.com\/stories\/([a-zA-Z0-9_.-]+)\/(\d+)/,
    // Profile URL pattern - matches instagram.com/username (with optional trailing slash)
    profile: /instagram\.com\/([a-zA-Z0-9_.]+)(?:\/)?(?:\?.*)?$/,
  },
  twitter: {
    video: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/,
  },
};

// Reserved Instagram paths that are NOT profiles
const INSTAGRAM_RESERVED_PATHS = [
  'p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts',
  'about', 'legal', 'help', 'api', 'developer', 'privacy', 'terms',
  'session', 'settings', 'emails', 'notifications', 'nametag',
];

export function detectPlatform(url: string): DetectionResult {
  const trimmedUrl = url.trim();

  // YouTube
  if (PATTERNS.youtube.short.test(trimmedUrl)) {
    return { platform: 'youtube', contentType: 'short', isValid: true };
  }
  if (PATTERNS.youtube.video.test(trimmedUrl)) {
    return { platform: 'youtube', contentType: 'video', isValid: true };
  }

  // Instagram - check specific patterns first
  if (PATTERNS.instagram.story.test(trimmedUrl)) {
    return { platform: 'instagram', contentType: 'story', isValid: true };
  }
  if (PATTERNS.instagram.reel.test(trimmedUrl)) {
    return { platform: 'instagram', contentType: 'reel', isValid: true };
  }
  if (PATTERNS.instagram.post.test(trimmedUrl)) {
    return { platform: 'instagram', contentType: 'post', isValid: true };
  }

  // Instagram Profile - check if it's an Instagram URL with just a username
  if (trimmedUrl.includes('instagram.com')) {
    try {
      const urlObj = new URL(trimmedUrl);
      const pathname = urlObj.pathname.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes

      // Check if it's a profile URL (single path segment that's not reserved)
      if (pathname && !pathname.includes('/') && !INSTAGRAM_RESERVED_PATHS.includes(pathname.toLowerCase())) {
        // It's a profile URL like instagram.com/username
        return { platform: 'instagram', contentType: 'profile', isValid: true };
      }
    } catch {
      // Invalid URL, continue to other checks
    }
  }

  // Twitter/X
  if (PATTERNS.twitter.video.test(trimmedUrl)) {
    return { platform: 'twitter', contentType: 'video', isValid: true };
  }

  return { platform: 'unknown', contentType: 'video', isValid: false };
}

export function getPlatformName(platform: Platform): string {
  const names: Record<Platform, string> = {
    youtube: 'YouTube',
    instagram: 'Instagram',
    twitter: 'X/Twitter',
    unknown: 'Desconhecido',
  };
  return names[platform];
}

export function getContentTypeName(contentType: ContentType): string {
  const names: Record<ContentType, string> = {
    video: 'Video',
    reel: 'Reel',
    story: 'Story',
    post: 'Post',
    short: 'Short',
    profile: 'Perfil',
  };
  return names[contentType];
}

export function extractUsernameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url.trim());
    if (!urlObj.hostname.includes('instagram.com')) return null;
    const pathname = urlObj.pathname.replace(/^\/+|\/+$/g, '');
    if (pathname && !pathname.includes('/') && !INSTAGRAM_RESERVED_PATHS.includes(pathname.toLowerCase())) {
      return pathname;
    }
  } catch {
    // Invalid URL
  }
  return null;
}

export function getPlatformColor(platform: Platform): string {
  const colors: Record<Platform, string> = {
    youtube: '#FF0000',
    instagram: '#E4405F',
    twitter: '#1DA1F2',
    unknown: '#71717A',
  };
  return colors[platform];
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
