import { Link } from 'react-router-dom';
import type { GameHighlight } from '../api/types';
import { GAME_THUMBNAILS } from '../games/registry';

const SCORE_FORMAT = new Intl.NumberFormat('ko-KR');

function points(value: number): string {
  return `${SCORE_FORMAT.format(value)}점`;
}

interface GameCardProps {
  game: GameHighlight;
  isAuthenticated: boolean;
}

/** 로비의 게임 카드: 대표 그림, 설명, 현재 1위, 내 최고 기록 */
export default function GameCard({ game, isAuthenticated }: GameCardProps) {
  const Thumbnail = GAME_THUMBNAILS[game.slug];

  return (
    <Link
      to={`/g/${game.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 transition hover:-translate-y-0.5 hover:border-sky-400"
    >
      {Thumbnail && (
        <div className="h-36">
          <Thumbnail />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-bold text-slate-50">{game.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{game.description}</p>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">1위</dt>
            <dd className="min-w-0 truncate text-right text-slate-200">
              {game.topScore === null ? '아직 없어요' : `${game.topNickname ?? ''} · ${points(game.topScore)}`}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">내 기록</dt>
            <dd className="text-right text-slate-200">
              {game.myBest !== null
                ? `${points(game.myBest)}${game.myRank !== null ? ` · ${game.myRank}위` : ''}`
                : isAuthenticated
                  ? '아직 기록이 없어요'
                  : '로그인하면 보여요'}
            </dd>
          </div>
        </dl>

        <span className="mt-4 inline-block text-sm font-semibold text-sky-300 transition group-hover:translate-x-0.5">플레이 →</span>
      </div>
    </Link>
  );
}
