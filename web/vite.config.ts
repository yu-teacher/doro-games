import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

/** 게이트웨이에서 /games/ 하위 경로로 마운트한다(블로그가 /api/v1/ 을 쓰므로 같은 경로를 쓸 수 없다). */
const BASE = '/games/';
const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8087';
const THEME_COLOR = '#0f172a';

const BASE_WITHOUT_SLASH = BASE.replace(/\/+$/, '');

/**
 * 라우터의 기준 경로가 /games 라서 앱 안에서 홈으로 가면 주소가 "/games"(끝에 / 없음)가 된다.
 * 운영에서는 게이트웨이가 /games 를 /games/ 로 보내 주지만(deploy/gateway-games.conf), 개발·미리보기 서버에는 그 규칙이 없어서
 * 이 주소로 새로고침하면 404 안내가 뜬다. 같은 규칙을 맞춰 준다.
 */
function redirectBaseWithoutSlash(): Plugin {
  const redirect = (url: string | undefined): string | null => {
    if (url === undefined) {
      return null;
    }
    const [path, query] = url.split('?', 2);
    return path === BASE_WITHOUT_SLASH ? `${BASE}${query === undefined ? '' : `?${query}`}` : null;
  };
  const middleware = (req: { url?: string }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: () => void }, next: () => void) => {
    const target = redirect(req.url);
    if (target === null) {
      next();
      return;
    }
    res.statusCode = 301;
    res.setHeader('Location', target);
    res.end();
  };
  return {
    name: 'games-redirect-base-without-slash',
    configureServer: (server) => {
      server.middlewares.use(middleware);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [
    redirectBaseWithoutSlash(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '도로 게임 천국',
        short_name: '도로 게임 천국',
        description: '잠깐 쉬어 가는 미니게임 모음',
        lang: 'ko',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: THEME_COLOR,
        theme_color: THEME_COLOR,
        icons: [
          { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // 앱 셸(정적 파일)만 캐시한다. 로그인·기록이 담긴 API 는 절대 캐시하지 않는다.
        navigateFallback: `${BASE}index.html`,
        navigateFallbackDenylist: [/^\/games\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3006,
    proxy: {
      // 게이트웨이처럼 /games 를 떼고 백엔드로 전달한다
      '/games/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/games/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
