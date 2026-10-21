import { Link, useLocation } from 'react-router-dom';
import { buildLoginUrl, useAuthStore } from '../store/authStore';
import { useProfileDialog } from '../store/profileDialogStore';
import ServiceLauncher from './ServiceLauncher';

export default function Header() {
  const { user, isAuthenticated, signOut } = useAuthStore();
  const showProfile = useProfileDialog((s) => s.show);
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}`;

  return (
    <header className="flex items-center justify-between px-4 py-3 sm:px-6">
      <div className="flex items-center gap-1">
        {/* 허브(/)는 이 앱의 라우터 밖이라 일반 링크로 이동한다 */}
        <a href="/" className="-ml-2 rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="도로 홈으로" title="도로 홈으로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
            <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </a>
        <Link to="/" className="inline-block py-1 text-lg font-bold tracking-tight text-sky-300">
          도로 게임 천국
        </Link>
      </div>
      <div className="relative flex items-center gap-2">
      <ServiceLauncher currentId="games" />
      {isAuthenticated && user ? (
        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={showProfile} title="프로필 수정" className="font-medium text-slate-200 underline-offset-4 hover:text-sky-300 hover:underline">
            {user.nickname}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-slate-600 px-3 py-1 text-slate-300 hover:bg-slate-800"
          >
            로그아웃
          </button>
        </div>
      ) : (
        <a href={buildLoginUrl(returnPath)} className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">
          로그인
        </a>
      )}
      </div>
    </header>
  );
}
