import type { Page, Route } from '@playwright/test';

const API = '/games/api/v1';
const LONG_NICKNAME = '아주아주긴닉네임을가진러너입니다'.repeat(2);
const LONG_UNBROKEN = 'x'.repeat(48);

const me = { id: 'u-me', username: 'doro', nickname: '도로롱', color: '#10b981' };
const game = { slug: 'runner', title: '도로 러너', description: '장애물을 피해 최대한 멀리 달려요.', enabled: true };
const entries = [
  { rank: 1, userId: 'a', nickname: LONG_NICKNAME, color: '#f59e0b', score: 153000, achievedAt: '2026-10-09T00:00:00Z' },
  { rank: 2, userId: 'b', nickname: LONG_UNBROKEN, color: '#3b82f6', score: 98000, achievedAt: '2026-10-09T00:00:00Z' },
  { rank: 3, userId: 'u-me', nickname: '도로롱', color: '#10b981', score: 640, achievedAt: '2026-10-09T00:00:00Z' },
];

const envelope = (data: unknown) => ({ success: true, data, timestamp: new Date().toISOString() });
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export interface MockOptions {
  loggedIn: boolean;
}

/** 게임 서버(BFF 세션 포함) 응답을 가짜로 대체한다. 모르는 요청은 404 로 두어 예상치 못한 호출을 드러낸다. */
export async function mockApi(page: Page, { loggedIn }: MockOptions): Promise<void> {
  await page.route((url) => url.pathname.startsWith(API), async (route) => {
    const request = route.request();
    // 화면 이동이 아니라 데이터 요청(xhr/fetch)만 가로챈다
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.fallback();
    const path = new URL(request.url()).pathname.slice(API.length);

    if (path === '/bff/session') return json(route, envelope(loggedIn ? { authenticated: true, user: me } : { authenticated: false, user: null }));
    if (path === '/games') return json(route, envelope([game]));
    if (path === '/games/highlights') {
      return json(route, envelope([{ ...game, myBest: loggedIn ? 640 : null, myRank: loggedIn ? 3 : null, topScore: 153000, topNickname: LONG_NICKNAME, plays: 12 }]));
    }
    if (path === '/games/runner') return json(route, envelope(game));
    if (path === '/games/runner/leaderboard') return json(route, envelope({ slug: 'runner', entries }));
    if (path === '/games/runner/me') return loggedIn ? json(route, envelope({ best: 640, plays: 12, rank: 3 })) : json(route, { success: false, code: 'UNAUTHORIZED' }, 401);
    if (path === '/games/runner/runs') return json(route, envelope({ runId: 'run1', startedAt: new Date().toISOString() }));
    return json(route, { success: false, code: 'NOT_MOCKED', message: `${request.method()} ${path}` }, 404);
  });
}
