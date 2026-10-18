import Mascot from './Mascot';

/** 귤 폭격 도로롱 카드의 대표 그림: 원근 도로, 체력 숫자가 달린 거대 귤, 게이트, 달리는 도로롱 */
export default function OrangeThumbnail() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-sky-950 to-slate-900" aria-hidden="true">
      <svg viewBox="0 0 320 144" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <polygon points="150,26 170,26 300,144 20,144" fill="#27364b" />
        <line x1="150" y1="26" x2="20" y2="144" stroke="#e2e8f0" strokeWidth="3" />
        <line x1="170" y1="26" x2="300" y2="144" stroke="#e2e8f0" strokeWidth="3" />
        <line x1="157" y1="28" x2="120" y2="144" stroke="#e2e8f0" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="8 8" />
        <line x1="163" y1="28" x2="200" y2="144" stroke="#e2e8f0" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="8 8" />
        <rect x="108" y="58" width="52" height="22" fill="#38bdf8" fillOpacity="0.6" stroke="#38bdf8" />
        <rect x="162" y="58" width="52" height="22" fill="#f87171" fillOpacity="0.6" stroke="#f87171" />
        <text x="134" y="74" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">+4</text>
        <text x="188" y="74" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">−2</text>
        <circle cx="86" cy="96" r="24" fill="#fb923c" />
        <text x="86" y="102" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff" stroke="#0f172a" strokeWidth="2.5" paintOrder="stroke">490</text>
        <circle cx="232" cy="104" r="18" fill="#fb923c" />
        <text x="232" y="109" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" stroke="#0f172a" strokeWidth="2.5" paintOrder="stroke">86</text>
      </svg>
      <Mascot className="absolute -bottom-1 left-1/2 w-14 -translate-x-1/2" />
    </div>
  );
}
