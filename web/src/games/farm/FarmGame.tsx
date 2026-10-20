import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { buyProducer, buyTapUpgrade, getIdle, tapIdle } from '../../api/idleApi';
import type { IdleView } from '../../api/types';
import { buildLoginUrl, useAuthStore } from '../../store/authStore';
import { ASSET_DIR, loadSprites, variantOf, type Sprites } from '../orange/assets';
import { formatCount } from '../orange/format';
import { canAfford, maxBuyHint, projectOranges } from './live';

const ASSET_BASE = `${import.meta.env.BASE_URL}${ASSET_DIR}/`;
/** 서버에 탭을 모아 보내는 간격, 그리고 서버 값으로 다시 맞추는 간격 */
const FLUSH_MS = 350;
const SYNC_MS = 15_000;
const BUY_AMOUNTS = [1, 10, 100] as const;
type BuyAmount = (typeof BUY_AMOUNTS)[number];

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
}

/** 자리 비운 시간을 "3시간 20분" 처럼 */
function formatAway(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

/** 많이 살 때 드는 비용의 근사(15% 씩 오르는 합). 정확한 값은 서버가 계산하고, 여기서는 버튼에 "약" 으로만 보여 준다. */
function approxCost(nextCost: number, amount: number): number {
  if (amount <= 1) {
    return nextCost;
  }
  return Math.ceil((nextCost * (1.15 ** amount - 1)) / 0.15);
}

/**
 * 도로롱 귤농장(방치형). 모든 값은 서버가 저장·계산하고, 이 화면은 보여 주고 요청만 보낸다.
 * 귤 수는 서버 값에 흐른 시간을 더해 부드럽게 올려 보이며, 서버 응답이 오면 그 값으로 다시 맞춘다.
 */
export default function FarmGame() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [view, setView] = useState<IdleView | null>(null);
  const [shown, setShown] = useState(0);
  const [amount, setAmount] = useState<BuyAmount>(1);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sprites, setSprites] = useState<Sprites>({});
  const [floaters, setFloaters] = useState<Floater[]>([]);

  const viewRef = useRef<IdleView | null>(null);
  const receivedAtRef = useRef(0);
  const pendingRef = useRef(0);
  const inFlightRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floaterIdRef = useRef(0);

  const accept = useCallback((next: IdleView) => {
    viewRef.current = next;
    receivedAtRef.current = performance.now();
    setView(next);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    void loadSprites(ASSET_BASE, abort.signal).then(setSprites);
    return () => abort.abort();
  }, []);

  /** 모아 둔 탭을 서버로 보낸다. 한 번에 한 요청만 보낸다. */
  const flush = useCallback(async (): Promise<void> => {
    if (inFlightRef.current || pendingRef.current <= 0) {
      return;
    }
    const count = Math.min(100, pendingRef.current);
    pendingRef.current -= count;
    inFlightRef.current = true;
    try {
      accept(await tapIdle(count));
      setError(null);
    } catch (e) {
      // 못 보낸 탭은 버린다(서버 기준이 항상 맞다). 다음 동기화에서 서버 값으로 돌아온다.
      setError(e instanceof ApiError ? e.message : '서버와 연결하지 못했어요.');
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current > 0) {
        flushTimerRef.current = setTimeout(() => void flush(), FLUSH_MS);
      }
    }
  }, [accept]);

  const sync = useCallback(async () => {
    await flush();
    try {
      accept(await getIdle());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '서버와 연결하지 못했어요.');
    }
  }, [accept, flush]);

  // 처음 불러오기(자리 비운 동안의 정산을 알린다), 주기적 동기화, 탭으로 돌아왔을 때 동기화
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }
    const abort = new AbortController();
    getIdle(abort.signal)
      .then((first) => {
        accept(first);
        if (first.offlineSeconds > 0 && first.offlineGained > 0) {
          setNotice({
            tone: 'ok',
            text: `자리를 비운 ${formatAway(first.offlineSeconds)} 동안 귤 ${formatCount(first.offlineGained)}개가 열렸어요${first.offlineCapped ? ' (최대 8시간까지만 쌓여요)' : ''}.`,
          });
        }
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) {
          setError(e instanceof ApiError ? e.message : '농장을 불러오지 못했어요.');
        }
      });
    const timer = setInterval(() => void sync(), SYNC_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void sync();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      abort.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [isAuthenticated, accept, sync]);

  // 화면의 귤 수를 부드럽게 올린다(0.1초마다)
  useEffect(() => {
    const timer = setInterval(() => {
      const v = viewRef.current;
      if (v) {
        setShown(projectOranges(v, receivedAtRef.current, performance.now(), pendingRef.current));
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const onTap = (event: React.PointerEvent<HTMLButtonElement>) => {
    const v = viewRef.current;
    if (!v) {
      return;
    }
    pendingRef.current += 1;
    const rect = event.currentTarget.getBoundingClientRect();
    const id = (floaterIdRef.current += 1);
    setFloaters((list) => [...list.slice(-8), { id, x: event.clientX - rect.left, y: event.clientY - rect.top, text: `+${formatCount(v.tapPower)}` }]);
    setTimeout(() => setFloaters((list) => list.filter((f) => f.id !== id)), 800);
    setShown(projectOranges(v, receivedAtRef.current, performance.now(), pendingRef.current));
    if (!flushTimerRef.current || !inFlightRef.current) {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = setTimeout(() => void flush(), FLUSH_MS);
    }
  };

  const purchase = async (action: () => Promise<IdleView>) => {
    setNotice(null);
    try {
      await flush(); // 서버가 내 탭을 먼저 알아야 귤이 맞는다
      accept(await action());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '요청을 보내지 못했어요.');
      void sync();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
        <p className="text-lg font-bold text-slate-50">🍊 도로롱 귤농장</p>
        <p className="mt-2 text-sm text-slate-400">농장은 서버에 저장돼서 로그인이 필요해요. 자리를 비워도 귤은 계속 열려요!</p>
        <a href={buildLoginUrl('/g/orange-farm')} className="mt-4 inline-block rounded-lg bg-sky-400 px-5 py-2 font-semibold text-slate-950">
          로그인
        </a>
      </div>
    );
  }
  if (!view) {
    return <p className="text-center text-slate-400">{error ?? '농장을 불러오는 중…'}</p>;
  }

  // 가장 앞선(번호가 큰) 도로롱이 탭 버튼에 나온다
  const lead = [...view.producers].reverse().find((p) => p.level > 0)?.index ?? 0;
  const leadImage = variantOf(sprites, 'tile', lead);
  const hasImages = Boolean(sprites.variants?.tile);
  const firstHidden = view.producers.findIndex((p) => !p.revealed);

  return (
    <div className="mx-auto w-full max-w-md select-none">
      <div className="rounded-2xl bg-slate-900 p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">귤</p>
        <p className="font-mono text-4xl font-extrabold text-orange-300" aria-live="off">
          🍊 {formatCount(shown)}
        </p>
        <p className="mt-1 text-sm text-slate-300">초당 +{formatCount(view.ratePerSecond)}</p>
        <p className="text-xs text-slate-500">
          도감 {view.collected}/{view.collectionTotal} · 생산 ×{(view.multiplierPercent / 100).toFixed(2)}
        </p>
      </div>

      <div className="relative mt-3 flex justify-center">
        <button
          type="button"
          aria-label="귤 따기"
          onPointerDown={onTap}
          className="relative flex h-44 w-44 touch-manipulation items-center justify-center rounded-full border-4 border-orange-300/60 bg-orange-400/20 shadow-lg active:scale-95"
        >
          {hasImages && leadImage ? <img src={leadImage.src} alt="" draggable={false} className="h-36 w-36 object-contain" /> : <span className="text-6xl">🍊</span>}
          {floaters.map((f) => (
            <span key={f.id} className="farm-float pointer-events-none absolute font-mono text-lg font-extrabold text-orange-200" style={{ left: f.x, top: f.y }}>
              {f.text}
            </span>
          ))}
        </button>
      </div>
      <p className="mt-1 text-center text-xs text-slate-500">눌러서 귤 따기 (한 번에 +{formatCount(view.tapPower)})</p>

      <div aria-live="polite" className="mt-2 min-h-5 text-center text-sm">
        {notice && <p className={notice.tone === 'ok' ? 'text-emerald-300' : 'text-amber-300'}>{notice.text}</p>}
        {error && <p className="text-amber-300">{error}</p>}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">도로롱 키우기</h2>
        <div role="radiogroup" aria-label="한 번에 살 수" className="flex gap-1">
          {BUY_AMOUNTS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={amount === n}
              onClick={() => setAmount(n)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${amount === n ? 'bg-sky-400 text-slate-950' : 'border border-slate-600 text-slate-300'}`}
            >
              ×{n}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-2 space-y-2">
        <li className="flex items-center gap-3 rounded-xl bg-slate-900 p-2.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-2xl">🧤</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-100">귤 따기 장갑 <span className="font-mono text-slate-400">Lv.{view.tapLevel}</span></span>
            <span className="block text-xs text-slate-400">탭 한 번에 +{formatCount(view.tapPower)}</span>
          </span>
          <BuyButton cost={view.tapUpgradeCost} amount={amount} shown={shown} onBuy={() => void purchase(() => buyTapUpgrade(amount))} />
        </li>
        {view.producers.map((p) => {
          if (!p.revealed) {
            return p.index === firstHidden ? (
              <li key={p.index} className="flex items-center gap-3 rounded-xl bg-slate-900/50 p-2.5 text-slate-600">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-2xl">❔</span>
                <span className="text-sm">??? (귤을 더 모으면 나타나요)</span>
              </li>
            ) : null;
          }
          const image = variantOf(sprites, 'tile', p.index);
          return (
            <li key={p.index} className="flex items-center gap-3 rounded-xl bg-slate-900 p-2.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                {hasImages && image ? (
                  <img src={image.src} alt="" draggable={false} className={`h-10 w-10 object-contain ${p.level > 0 ? '' : 'opacity-40 grayscale'}`} />
                ) : (
                  <span className="text-2xl">🍊</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-100">
                  {p.name} <span className="font-mono text-slate-400">Lv.{p.level}</span>
                </span>
                <span className="block text-xs text-slate-400">
                  1마리 +{formatCount(Math.floor((p.baseRate * view.multiplierPercent) / 100))}/초 · 지금 +{formatCount(p.ratePerSecond)}/초
                </span>
              </span>
              <BuyButton cost={p.nextCost} amount={amount} shown={shown} onBuy={() => void purchase(() => buyProducer(p.index, amount))} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BuyButton({ cost, amount, shown, onBuy }: { cost: number; amount: number; shown: number; onBuy: () => void }) {
  const hint = maxBuyHint(cost, shown, amount);
  const ok = canAfford(cost, shown);
  const label = amount === 1 ? formatCount(cost) : `약 ${formatCount(approxCost(cost, amount))}`;
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={!ok}
      className={`w-24 shrink-0 rounded-lg px-2 py-2 text-xs font-bold ${ok ? 'bg-orange-400 text-slate-950 active:scale-95' : 'bg-slate-800 text-slate-500'}`}
      aria-label={`${amount}번 사기, 비용 ${label}`}
    >
      <span className="block">{ok ? (amount > 1 && hint < amount ? `${hint}번 가능` : '키우기') : '귤 부족'}</span>
      <span className="block font-mono">🍊 {label}</span>
    </button>
  );
}
