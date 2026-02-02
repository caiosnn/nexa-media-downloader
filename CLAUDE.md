# CLAUDE.md

## Project Overview

PL Media Downloader - Internal media download tool for Partido Liberal. Downloads videos, reels, stories, and posts from YouTube, Instagram, and Twitter/X.

## Tech Stack

- **Framework:** Next.js 16.1.4 (Turbopack) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4 + Radix UI components + custom glass design system
- **External tools:** yt-dlp, instaloader, ffmpeg (all Windows executables)
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
│       │   ├── login/route.ts      # Instagram login via instaloader
│       │   ├── cookies/route.ts    # Cookie import
│       │   ├── status/route.ts     # Session status check
│       │   └── logout/route.ts     # Logout
│       ├── settings/route.ts       # RapidAPI settings CRUD
│       └── captcha/route.ts        # Math CAPTCHA generation/validation
├── components/
│   ├── header.tsx                  # Header with Instagram status
│   ├── download-section.tsx        # URL input + download progress UI
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
│   ├── instagram-scraper.ts        # Multi-method scraper (WebAPI/GraphQL/HTML/Puppeteer)
│   ├── rate-limiter.ts             # Sliding window rate limiting
│   ├── captcha.ts                  # Math CAPTCHA system
│   ├── cache.ts                    # In-memory TTL cache
│   └── utils.ts
└── types/index.ts                  # TypeScript type definitions
```

## External Tool Paths (Windows)

```
yt-dlp:       C:\Users\User\AppData\Local\Programs\Python\Python314\Scripts\yt-dlp.exe
instaloader:  C:\Users\User\AppData\Roaming\Python\Python314\Scripts\instaloader.exe
ffmpeg:       C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin
```

Paths are hardcoded in `src/app/api/download/route.ts` (lines 29-33).

## Download Strategy

- **YouTube/Twitter:** yt-dlp with format fallback (`bv*+ba/b` then `b`)
- **Instagram Stories:** RapidAPI -> Scraper Engine (4 methods) -> Instaloader session -> yt-dlp cookies
- **Instagram Posts/Reels:** yt-dlp -> instaloader fallback
- Files saved as `{timestamp}_{video_title}.{ext}` in `downloads/`, auto-deleted after 1 hour

## Key Configuration

- `settings.json` - RapidAPI key and toggle (root of project)
- `cookies.txt` - Instagram cookies for yt-dlp (optional)
- `.instagram-session/` - Instaloader session files (optional)
- `next.config.ts` - Has `turbopack.resolveAlias` to fix module resolution from parent directory

## Development

```bash
cd pl-media-downloader
npm install
npm run dev    # http://localhost:3000
```

## Important Notes

- The parent directory (`PL Download Stories`) must NOT have a `package-lock.json` — it confuses Turbopack's workspace root detection
- `next.config.ts` uses `turbopack.resolveAlias` to explicitly resolve `tailwindcss` and `tw-animate-css` from `node_modules`
- Rate limiter: 10 requests/min per IP, CAPTCHA after 3 failures
- Cache TTLs: user IDs 24h, stories 2h, download results 30min
- All in-memory (no database) — resets on server restart
