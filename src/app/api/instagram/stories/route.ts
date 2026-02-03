import { NextRequest, NextResponse } from 'next/server';
import { fetchStories, fetchUserInfoViaStoriesIG, fetchUserInfoViaInstaloader } from '@/lib/instagram-scraper';

export const runtime = 'nodejs';

/** Proxy an Instagram CDN image URL through our thumbnail endpoint */
function proxyImageUrl(url: string): string {
  if (!url) return '';
  return `/api/instagram/stories/thumbnail?url=${encodeURIComponent(url)}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username')?.trim().replace(/^@/, '');

  if (!username) {
    return NextResponse.json(
      { success: false, error: 'Username e obrigatorio' },
      { status: 400 }
    );
  }

  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    return NextResponse.json(
      { success: false, error: 'Username invalido' },
      { status: 400 }
    );
  }

  try {
    // Fetch stories using the scraper engine (StoriesIG → Instaloader → WebAPI → GraphQL)
    const skipCache = searchParams.get('refresh') === 'true';
    const scraperResult = await fetchStories(username, skipCache);

    let stories: Array<{
      id: string;
      mediaUrl: string;
      thumbnailUrl: string;
      mediaType: 'image' | 'video';
      postedAt: string;
      expiresAt: string;
    }> = [];

    if (scraperResult.success && scraperResult.stories) {
      stories = scraperResult.stories.map((s) => {
        // For thumbnails: use dedicated thumbnail if available, otherwise use main URL for images
        const rawThumb = s.thumbnailUrl || (s.mediaType === 'video' ? '' : s.url);

        return {
          id: s.id,
          mediaUrl: s.url,
          thumbnailUrl: rawThumb ? proxyImageUrl(rawThumb) : '',
          mediaType: s.mediaType,
          postedAt: new Date(s.takenAt * 1000).toISOString(),
          expiresAt: new Date((s.takenAt + 86400) * 1000).toISOString(),
        };
      });
    }

    // User info — use from scraper result if available (avoids second Puppeteer call)
    let user = null;

    if (scraperResult.userInfo) {
      user = {
        id: scraperResult.userInfo.id,
        username: scraperResult.userInfo.username,
        displayName: scraperResult.userInfo.fullName || username,
        profilePicUrl: proxyImageUrl(scraperResult.userInfo.profilePicUrl),
        isPrivate: scraperResult.userInfo.isPrivate,
      };
    }

    // Fallback: fetch user info separately via StoriesIG
    if (!user) {
      const storiesIGUser = await fetchUserInfoViaStoriesIG(username);
      if (storiesIGUser) {
        user = {
          id: storiesIGUser.id,
          username: storiesIGUser.username,
          displayName: storiesIGUser.fullName || username,
          profilePicUrl: proxyImageUrl(storiesIGUser.profilePicUrl),
          isPrivate: storiesIGUser.isPrivate,
        };
      }
    }

    // Fallback: instaloader
    if (!user) {
      const instaloaderUser = await fetchUserInfoViaInstaloader(username);
      if (instaloaderUser) {
        user = {
          id: instaloaderUser.id,
          username: instaloaderUser.username,
          displayName: instaloaderUser.fullName || username,
          profilePicUrl: proxyImageUrl(instaloaderUser.profilePicUrl),
          isPrivate: instaloaderUser.isPrivate,
        };
      }
    }

    // Final fallback: minimal user info
    if (!user) {
      user = {
        id: username,
        username,
        displayName: username,
        profilePicUrl: '',
        isPrivate: false,
      };
    }

    // If no stories found
    if (stories.length === 0) {
      return NextResponse.json({
        success: true,
        user,
        stories,
        message: scraperResult.error || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      user,
      stories,
    });
  } catch (error) {
    console.error('[Stories API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao buscar stories. Tente novamente.',
      },
      { status: 500 }
    );
  }
}
