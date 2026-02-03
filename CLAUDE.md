# CLAUDE.md

## Project Overview

PL Media Downloader - Internal media download tool for Partido Liberal. Downloads videos, reels, stories, and posts from YouTube, Instagram, and Twitter/X.

## Tech Stack

- **Framework:** Next.js 16.1.4 (Turbopack dev, Webpack prod) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4 + Radix UI components + custom glass design system
- **External tools:** yt-dlp, instaloader, ffmpeg, Puppeteer (Chromium)
- **Language:** Portuguese (Brazil) UI

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main page (client component)
│   ├── layout.tsx                  # Root layout (dark mode, Toaster)
│   ├── globals.css                 # Design system (glass effects, gradients, animations)
│   ├── settings/page.tsx           # RapidAPI config page
│   └── api/
│       ├── download/
│       │   ├── route.ts            # Main download handler (POST) - core logic
│       │   └── file/route.ts       # File serving endpoint (GET)
│       ├── instagram/
│       │   ├── stories/
│       │   │   ├── route.ts        # Stories fetch endpoint (GET)
│       │   │   └── thumbnail/route.ts  # CDN image proxy (bypasses CORS)
│       │   ├── login/route.ts      # Instagram login via instaloader
│       │   ├── cookies/route.ts    # Cookie import
│       │   ├── status/route.ts     # Session status check
│       │   └── logout/route.ts     # Logout
│       ├── settings/route.ts       # RapidAPI settings CRUD
│       └── captcha/route.ts        # Math CAPTCHA generation/validation
├── components/
│   ├── header.tsx                  # Header with Instagram status
│   ├── download-section.tsx        # URL input + download progress + profile stories UI
│   ├── story-search-section.tsx    # Dedicated story search section
│   ├── history-section.tsx         # Download history display
│   ├── influencer-section.tsx      # Influencer management
│   ├── add-influencer-dialog.tsx
│   ├── instagram-settings-dialog.tsx
│   ├── captcha-dialog.tsx
│   ├── platform-icon.tsx
│   └── ui/                         # shadcn/Radix component wrappers
├── lib/
│   ├── platform-detector.ts        # URL pattern matching (YouTube/Instagram/Twitter)
│   ├── instagram-rapidapi.ts       # RapidAPI integration with retry logic
│   ├── instagram-scraper.ts        # Multi-method scraper (StoriesIG API/Puppeteer/Instaloader)
│   ├── rate-limiter.ts             # Sliding window rate limiting
│   ├── captcha.ts                  # Math CAPTCHA system
│   ├── cache.ts                    # In-memory TTL cache
│   └── utils.ts
└── types/index.ts                  # TypeScript type definitions
```

## Download Strategy

- **YouTube/Twitter:** yt-dlp with format fallback (`bv*+ba/b` then `b`)
- **Instagram Stories:** RapidAPI -> StoriesIG hidden API (`instagram/stories` endpoint via Puppeteer + Vue.js signing) -> Instaloader session -> yt-dlp cookies
- **Instagram Posts/Reels:** yt-dlp -> instaloader fallback
- **Profile URLs:** Detected as `contentType: 'profile'`, fetches stories via stories API and shows preview with thumbnails
- Files saved as `{timestamp}_{video_title}.{ext}` in `downloads/`, auto-deleted after 1 hour

## Instagram Stories Engine

The scraper (`instagram-scraper.ts`) uses StoriesIG.info's hidden API:
1. Launches Puppeteer, navigates to StoriesIG
2. Searches for username to initialize Vue.js signing context
3. Calls `instagram/stories` API endpoint directly via `$mediaSearchController.subscribeSignedRequestBody()`
4. This returns ALL stories (the DOM only shows 6, the API returns all)
5. Falls back to Instaloader if StoriesIG fails

## Environment Variables

| Variable | Default (Windows) | Docker/Linux |
|---|---|---|
| `YT_DLP_PATH` | Windows pip path | `yt-dlp` |
| `INSTALOADER_PATH` | Windows pip path | `instaloader` |
| `FFMPEG_DIR` | Windows WinGet path | `/usr/bin` |
| `PUPPETEER_EXECUTABLE_PATH` | (bundled Chromium) | `/usr/bin/chromium` |
| `PORT` | 3000 | 3000 |

## Key Configuration

- `settings.json` - RapidAPI key and toggle (root of project)
- `cookies.txt` - Instagram cookies for yt-dlp (optional)
- `.instagram-session/` - Instaloader session files (optional)
- `next.config.ts` - Has `turbopack.resolveAlias` to fix module resolution from parent directory

## Development (Windows)

```bash
cd pl-media-downloader
npm install
npm run dev    # http://localhost:3000
```

## Docker / Coolify Deployment

```bash
# Build and run locally
docker compose up --build

# Or just build
docker build -t pl-media-downloader .
docker run -p 3000:3000 --shm-size=1gb pl-media-downloader
```

### Coolify Setup

1. Create new service -> Docker Compose or Dockerfile
2. Point to the git repo (or upload files)
3. Build pack: Dockerfile
4. Port: 3000
5. Add `shm_size: 1gb` in Coolify's Docker settings (required for Chromium)
6. Optional: mount `settings.json` as a volume if using RapidAPI

### Docker Notes

- `shm_size: 1gb` is required — Chromium crashes with default 64MB shared memory
- The image is ~1.2GB due to Chromium + ffmpeg + Python
- Downloads are stored in a Docker volume (`downloads`), auto-cleaned after 1 hour
- All tool paths are set via environment variables in Dockerfile
- Puppeteer uses system Chromium (`PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`)

## Important Notes

- The parent directory (`PL Download Stories`) must NOT have a `package-lock.json` — it confuses Turbopack's workspace root detection
- `next.config.ts` uses `turbopack.resolveAlias` to explicitly resolve `tailwindcss` and `tw-animate-css` from `node_modules`
- Rate limiter: 10 requests/min per IP, CAPTCHA after 3 failures
- Cache TTLs: user IDs 24h, stories 2h, download results 30min
- All in-memory (no database) — resets on server restart
