import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listGames } from '../api/gamesApi';
import type { Game } from '../api/types';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; games: Game[] };

export default function PortalPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    listGames(controller.signal)
      .then((games) => setState({ status: 'ready', games }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error('Failed to load games', error);
        setState({ status: 'error', message: error instanceof Error ? error.message : '게임 목록을 불러오지 못했습니다.' });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <section className="py-8">
        <h1 className="text-2xl font-extrabold text-slate-50 sm:text-3xl">오늘은 어떤 게임을 달려볼까요?</h1>
        <p className="mt-2 text-slate-400">잠깐 쉬어 가는 미니게임 모음. 로그인하면 기록이 랭킹에 올라가요.</p>
      </section>

      {state.status === 'loading' && <p className="text-slate-400">불러오는 중…</p>}
      {state.status === 'error' && (
        <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-4 text-rose-200">
          {state.message}
        </p>
      )}
      {state.status === 'ready' && state.games.length === 0 && <p className="text-slate-400">아직 열려 있는 게임이 없어요.</p>}
      {state.status === 'ready' && state.games.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {state.games.map((game) => (
            <li key={game.slug}>
              <Link
                to={`/g/${game.slug}`}
                className="block h-full rounded-2xl border border-slate-700 bg-slate-900 p-5 transition hover:border-sky-400 hover:bg-slate-800"
              >
                <h2 className="text-lg font-bold text-slate-50">{game.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{game.description}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-sky-300">플레이 →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
