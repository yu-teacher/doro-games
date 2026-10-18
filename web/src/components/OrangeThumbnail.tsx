import Mascot from './Mascot';

/** 귤 폭격 도로롱 카드의 대표 그림: 귤 탄을 쏘는 도로롱과 몰려오는 적 */
export default function OrangeThumbnail() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-sky-950 to-slate-900" aria-hidden="true">
      <div className="absolute left-[18%] top-3 text-2xl">👾</div>
      <div className="absolute left-[46%] top-6 text-2xl">👾</div>
      <div className="absolute right-[16%] top-3 text-2xl">👾</div>
      <div className="absolute left-1/2 top-12 -translate-x-1/2 text-sm">🍊 🍊 🍊</div>
      <div className="absolute inset-x-6 top-[3.2rem] flex justify-between text-[11px] font-bold">
        <span className="rounded bg-sky-400/60 px-2 py-0.5 text-white">+4</span>
        <span className="rounded bg-yellow-400/70 px-2 py-0.5 text-slate-900">×2</span>
      </div>
      <Mascot className="absolute -bottom-1 left-1/2 w-16 -translate-x-1/2" />
    </div>
  );
}
