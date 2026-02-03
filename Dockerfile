FROM node:22-slim

# Install system dependencies: Chromium for Puppeteer, yt-dlp, ffmpeg, python3/pip for instaloader
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    unzip \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp and instaloader
RUN python3 -m pip install --break-system-packages yt-dlp instaloader

# Install Deno for yt-dlp JS challenges
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set tool paths for Linux
ENV YT_DLP_PATH=yt-dlp
ENV INSTALOADER_PATH=instaloader
ENV FFMPEG_DIR=/usr/bin

WORKDIR /app

# Copy package files and install ALL dependencies (devDeps needed for build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Clean npm cache (keeping all deps - tailwindcss needed by next.config.ts at runtime)
RUN npm cache clean --force

# Create downloads directory
RUN mkdir -p /app/downloads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
