import { useEffect, useState } from 'react';
import { getHighlights } from '../api/gamesApi';
import type { GameHighlight } from '../api/types';
import GameCard from '../components/GameCard';
import Hero from '../components/Hero';
import { useAuthStore } from '../store/authStore';
import { groupGames } from '../utils/lobby';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; games: GameHighlight[] };

export default function PortalPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  // 로그인 상태가 바뀌면(로그인·로그아웃) 내 기록이 달라지므로 다시 불러온다
  useEffect(() => {
    const controller = new AbortController();
    getHighlights(controller.signal)
      .then((games) => setState({ status: 'ready', games }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error('Failed to load the lobby', error);
        setState({ status: 'error', message: error instanceof Error ? error.message : '게임 목록을 불러오지 못했습니다.' });
      });
    return () => controller.abort();
  }, [isAuthenticated]);

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <Hero />

      {state.status === 'loading' && <p className="mt-10 text-slate-400">불러오는 중…</p>}
      {state.status === 'error' && (
        <p role="alert" className="mt-10 rounded-lg border border-rose-500/40 bg-rose-950/40 p-4 text-rose-200">
          {state.message}
        </p>
      )}
      {state.status === 'ready' && state.games.length === 0 && <p className="mt-10 text-slate-400">아직 열려 있는 게임이 없어요.</p>}
      {state.status === 'ready' &&
        groupGames(state.games).map((section) => (
          <section key={section.category} aria-labelledby={`lobby-${section.category}`} className="mt-10">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id={`lobby-${section.category}`} className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                {section.title}
              </h2>
              <p className="text-xs text-slate-500">{section.blurb}</p>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {section.games.map((game) => (
                <li key={game.slug}>
                  <GameCard game={game} isAuthenticated={isAuthenticated} />
                </li>
              ))}
              {section.category === 'minigame' && (
                <li>
                  <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 p-5 text-center">
                    <p className="text-lg font-bold text-slate-400">다음 게임 준비 중</p>
                    <p className="mt-1 text-sm text-slate-500">곧 새로운 미니게임이 문을 열어요.</p>
                  </div>
                </li>
              )}
            </ul>
          </section>
        ))}
    </main>
  );
}
