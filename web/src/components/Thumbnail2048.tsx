import Mascot from './Mascot';

const ROW = [
  { value: 2, className: 'bg-sky-200 text-slate-900' },
  { value: 4, className: 'bg-sky-300 text-slate-900' },
  { value: 8, className: 'bg-pink-300 text-white' },
  { value: 16, className: 'bg-pink-400 text-white' },
] as const;

/** 2048 카드의 대표 그림: 하늘색에서 분홍으로 커지는 타일과 놀러 온 마스코트 */
export default function Thumbnail2048() {
  return (
    <div className="relative flex h-full w-full items-center justify-center gap-2 bg-gradient-to-b from-slate-950 to-slate-900" aria-hidden="true">
      {ROW.map((tile) => (
        <div key={tile.value} className={`flex h-14 w-14 items-center justify-center rounded-lg text-xl font-extrabold ${tile.className}`}>
          {tile.value}
        </div>
      ))}
      <Mascot className="absolute -bottom-1 right-3 w-14" />
    </div>
  );
}
