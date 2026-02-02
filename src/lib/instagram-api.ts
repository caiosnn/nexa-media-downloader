import https from 'https';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const IG_APP_ID = '936619743392459';

interface InstagramUser {
  id: string;
  username: string;
  full_name: string;
  is_private: boolean;
  profile_pic_url: string;
}

interface StoryMedia {
  id: string;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  taken_at: number;
}

// Make HTTPS request with proper headers
function makeRequest(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'X-IG-App-ID': IG_APP_ID,
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Get user info from username
export async function getUserInfo(username: string): Promise<InstagramUser | null> {
  try {
    const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const response = await makeRequest(url);
    const data = JSON.parse(response);

    if (data.data?.user) {
      const user = data.data.user;
      return {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        is_private: user.is_private,
        profile_pic_url: user.profile_pic_url,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

// Get stories using Instagram's reels tray endpoint
export async function getStoriesFromReelsTray(userId: string): Promise<StoryMedia[]> {
  try {
    // Try the feed/reels_tray endpoint
    const url = `https://www.instagram.com/api/v1/feed/reels_tray/`;
    const response = await makeRequest(url);
    const data = JSON.parse(response);

    const stories: StoryMedia[] = [];

    if (data.tray) {
      for (const reel of data.tray) {
        if (reel.user?.pk?.toString() === userId || reel.user?.id?.toString() === userId) {
          if (reel.items) {
            for (const item of reel.items) {
              const media = parseStoryItem(item);
              if (media) stories.push(media);
            }
          }
        }
      }
    }

    return stories;
  } catch (error) {
    console.error('Error getting stories from reels tray:', error);
    return [];
  }
}

// Get user stories directly
export async function getUserStories(userId: string): Promise<StoryMedia[]> {
  try {
    // Try user reels media endpoint
    const url = `https://www.instagram.com/api/v1/feed/user/${userId}/story/`;
    const response = await makeRequest(url);
    const data = JSON.parse(response);

    const stories: StoryMedia[] = [];

    if (data.reel?.items) {
      for (const item of data.reel.items) {
        const media = parseStoryItem(item);
        if (media) stories.push(media);
      }
    }

    return stories;
  } catch (error) {
    console.error('Error getting user stories:', error);
    return [];
  }
}

// Parse story item to get media URL
function parseStoryItem(item: any): StoryMedia | null {
  try {
    const id = item.pk || item.id;
    const takenAt = item.taken_at || Math.floor(Date.now() / 1000);

    // Check if video
    if (item.video_versions && item.video_versions.length > 0) {
      // Get highest quality video
      const video = item.video_versions.sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0];
      return {
        id: id.toString(),
        media_type: 'video',
        url: video.url,
        thumbnail_url: item.image_versions2?.candidates?.[0]?.url,
        taken_at: takenAt,
      };
    }

    // Image
    if (item.image_versions2?.candidates && item.image_versions2.candidates.length > 0) {
      // Get highest quality image
      const image = item.image_versions2.candidates.sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0];
      return {
        id: id.toString(),
        media_type: 'image',
        url: image.url,
        taken_at: takenAt,
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing story item:', error);
    return null;
  }
}

// Try to get story media URL using Instagram's GraphQL
export async function getStoryByIdGraphQL(username: string, storyId: string): Promise<StoryMedia | null> {
  try {
    // First get user info
    const user = await getUserInfo(username);
    if (!user) {
      console.log('User not found:', username);
      return null;
    }

    if (user.is_private) {
      console.log('User is private:', username);
      return null;
    }

    // Try to get user stories
    const stories = await getUserStories(user.id);

    if (stories.length > 0) {
      // Find specific story by ID or return first one
      const story = stories.find(s => s.id === storyId || s.id.includes(storyId)) || stories[0];
      return story;
    }

    // Fallback: try reels tray
    const trayStories = await getStoriesFromReelsTray(user.id);
    if (trayStories.length > 0) {
      const story = trayStories.find(s => s.id === storyId || s.id.includes(storyId)) || trayStories[0];
      return story;
    }

    return null;
  } catch (error) {
    console.error('Error getting story by ID:', error);
    return null;
  }
}

// Download media from URL
export async function downloadMedia(mediaUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const urlObj = new URL(mediaUrl);

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
      },
    };

    const req = https.request(options, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadMedia(redirectUrl).then(resolve);
          return;
        }
      }

      if (res.statusCode !== 200) {
        console.error('Download failed with status:', res.statusCode);
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(Buffer.concat(chunks));
        } catch {
          resolve(null);
        }
      });
      res.on('error', () => resolve(null));
    });

    req.on('error', () => resolve(null));
    req.setTimeout(60000, () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

// Main function to get and download a story
export async function fetchAndDownloadStory(
  username: string,
  storyId: string
): Promise<{ buffer: Buffer; isVideo: boolean } | null> {
  console.log(`Fetching story for @${username}, storyId: ${storyId}`);

  const story = await getStoryByIdGraphQL(username, storyId);

  if (!story) {
    console.log('Story not found');
    return null;
  }

  console.log(`Found story: ${story.media_type}, downloading...`);

  const buffer = await downloadMedia(story.url);

  if (!buffer || buffer.length < 1000) {
    console.log('Failed to download media or file too small');
    return null;
  }

  return {
    buffer,
    isVideo: story.media_type === 'video',
  };
}
