import { useAuthStore } from '../store/authStore';
import { useProfileDialog } from '../store/profileDialogStore';
import { hasDefaultNickname } from '../utils/profile';
import Mascot from './Mascot';

/** 로비 맨 위: 인사와 마스코트가 달리는 도로 */
export default function Hero() {
  const user = useAuthStore((s) => s.user);
  const showProfile = useProfileDialog((s) => s.show);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 px-6 pt-8 sm:px-10 sm:pt-10">
      <div className="max-w-md pb-40 sm:pb-28">
        <p className="text-sm font-semibold text-pink-300">{user ? `${user.nickname} 님, 어서 와요!` : '어서 와요!'}</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight text-slate-50 sm:text-4xl">도로 게임 천국</h1>
        <p className="mt-3 text-slate-300">잠깐 쉬어 가는 미니게임과, 오래 두고 키우는 게임이 있는 곳이에요. 한 판만 하려다 열 판이 되어도 몰라요.</p>
        {hasDefaultNickname(user) && (
          <button
            type="button"
            onClick={showProfile}
            className="mt-4 rounded-full bg-pink-400/90 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-pink-300"
          >
            랭킹에 보일 닉네임을 정해 보세요
          </button>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-slate-800/80 sm:h-24" aria-hidden="true">
        <div className="h-0.5 bg-slate-600" />
        <div className="road-dashes mt-9 h-[3px] sm:mt-11" />
      </div>
      <Mascot className="pointer-events-none absolute bottom-[3rem] right-5 w-20 sm:bottom-14 sm:right-14 sm:w-36" />
    </section>
  );
}
