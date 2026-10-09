import mascotUrl from '../games/runner/assets/player.png';

interface MascotProps {
  className?: string;
  /** 통통 튀는 움직임을 줄지 */
  bounce?: boolean;
}

/** 도로 게임 천국의 마스코트. 로비와 게임 카드에서 쓴다. */
export default function Mascot({ className = '', bounce = true }: MascotProps) {
  return <img src={mascotUrl} alt="" draggable={false} className={`${bounce ? 'mascot-bob' : ''} select-none ${className}`} />;
}
