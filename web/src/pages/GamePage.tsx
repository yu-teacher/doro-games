import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getGame, getLeaderboard, getMyRecord, startRun, submitScore } from '../api/gamesApi';
import { ApiError } from '../api/client';
import type { Game, Leaderboard, MyRecord, Run } from '../api/types';
import { LEADERBOARD_SIZE } from '../config';
import { GAME_COMPONENTS } from '../games/registry';
import { buildLoginUrl, useAuthStore } from '../store/authStore';

type GameLoad = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; game: Game };

export default function GamePage() {
  const { slug = '' } = useParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [load, setLoad] = useState<GameLoad>({ status: 'loading' });
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [record, setRecord] = useState<MyRecord | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const runRef = useRef<Promise<Run | null> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: 'loading' });
    getGame(slug, controller.signal)
      .then((game) => setLoad({ status: 'ready', game }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn('Game not available', error);
          setLoad({ status: 'missing' });
        }
      });
    return () => controller.abort();
  }, [slug]);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLeaderboard(await getLeaderboard(slug, LEADERBOARD_SIZE, signal));
        setRecord(isAuthenticated ? await getMyRecord(slug, signal) : null);
      } catch (error) {
        if (!signal?.aborted) {
          console.error('Failed to refresh the leaderboard', error);
        }
      }
    },
    [slug, isAuthenticated],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const handleStart = useCallback(() => {
    setNotice(null);
    // 판은 게임이 시작되는 순간 서버가 시작 시각을 기록한다. 응답을 기다리느라 게임을 멈추지 않는다.
    runRef.current = isAuthenticated
      ? startRun(slug).catch((error: unknown) => {
          console.error('Failed to start a run', error);
          return null;
        })
      : null;
  }, [slug, isAuthenticated]);

  const handleGameOver = useCallback(
    (score: number) => {
      const pending = runRef.current;
      runRef.current = null;
      if (!isAuthenticated) {
        setNotice({ tone: 'warn', text: `${score}점! 로그인하면 기록이 랭킹에 올라가요.` });
        return;
      }
      if (score <= 0) {
        return;
      }
      void (async () => {
        const run = await pending;
        if (!run) {
          setNotice({ tone: 'warn', text: '이번 판은 서버에 시작이 기록되지 않아 점수를 올리지 못했어요.' });
          return;
        }
        try {
          const result = await submitScore(slug, run.runId, score);
          setNotice({
            tone: 'ok',
            text: result.newBest ? `${result.score}점 — 새 최고 기록! 현재 ${result.rank}위` : `${result.score}점 (최고 ${result.best}점, ${result.rank}위)`,
          });
          await refresh();
        } catch (error) {
          console.warn('Score submission failed', error);
          setNotice({ tone: 'warn', text: error instanceof ApiError ? error.message : '기록을 올리지 못했어요.' });
        }
      })();
    },
    [slug, isAuthenticated, refresh],
  );

  if (load.status === 'loading') {
    return <p className="px-4 py-8 text-slate-400">불러오는 중…</p>;
  }
  const GameComponent = load.status === 'ready' ? GAME_COMPONENTS[load.game.slug] : undefined;
  if (load.status === 'missing' || !GameComponent) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p role="alert" className="text-slate-300">
          열려 있지 않은 게임이에요.
        </p>
        <Link to="/" className="mt-4 inline-block text-sky-300">
          ← 게임 목록
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <Link to="/" className="text-sm text-slate-400 hover:text-sky-300">
        ← 게임 목록
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-slate-50">{load.game.title}</h1>
      <p className="mt-1 text-slate-400">{load.game.description}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section>
          <GameComponent best={record?.best ?? null} onStart={handleStart} onGameOver={handleGameOver} />
          <div aria-live="polite" className="mt-3 min-h-6 text-sm">
            {notice && <p className={notice.tone === 'ok' ? 'text-emerald-300' : 'text-amber-300'}>{notice.text}</p>}
          </div>
          {!isAuthenticated && (
            <p className="mt-2 text-sm text-slate-400">
              <a href={buildLoginUrl(`/g/${slug}`)} className="font-semibold text-sky-300 underline">
                로그인
              </a>
              하면 기록이 랭킹에 올라가요.
            </p>
          )}
          {record && (
            <p className="mt-2 text-sm text-slate-300">
              내 기록: <strong>{record.best}점</strong> · {record.rank}위 · {record.plays}판
            </p>
          )}
        </section>

        <aside aria-label="랭킹">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">랭킹</h2>
          {leaderboard && leaderboard.entries.length === 0 && <p className="mt-2 text-sm text-slate-500">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</p>}
          <ol className="mt-2 space-y-1">
            {leaderboard?.entries.map((entry) => (
              <li key={entry.userId} className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 text-right font-mono text-slate-500">{entry.rank}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                  <span className="truncate text-slate-200">{entry.nickname}</span>
                </span>
                <span className="font-mono font-semibold text-sky-300">{entry.score}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
