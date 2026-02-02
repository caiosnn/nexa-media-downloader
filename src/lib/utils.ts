import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date to a relative time string (e.g., "há 5 min", "há 2 horas")
 */
export function formatDistanceToNow(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'agora';
  }
  if (diffMins < 60) {
    return `há ${diffMins} min`;
  }
  if (diffHours < 24) {
    return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  }
  if (diffDays === 1) {
    return 'ontem';
  }
  if (diffDays < 7) {
    return `há ${diffDays} dias`;
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Format bytes to human readable string (e.g., "15.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Truncate a URL for display
 */
export function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) return url;

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    const truncatedPath = path.length > 20
      ? path.slice(0, 10) + '...' + path.slice(-10)
      : path;
    return urlObj.hostname + truncatedPath;
  } catch {
    return url.slice(0, maxLength - 3) + '...';
  }
}
