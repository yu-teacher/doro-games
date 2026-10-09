import Mascot from './Mascot';

/** 도로 러너 카드의 대표 그림: 도로 위를 달리는 마스코트와 콘 */
export default function RunnerThumbnail() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900" aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-slate-800">
        <div className="h-0.5 bg-slate-600" />
        <div className="road-dashes mt-5 h-[3px]" />
      </div>
      <Mascot className="absolute bottom-[26%] left-[14%] w-16" />
      <div
        className="absolute bottom-[32%] right-[18%] h-0 w-0 border-x-[10px] border-b-[26px] border-x-transparent border-b-orange-400"
        style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.3))' }}
      />
    </div>
  );
}
