import { Link, useLocation } from 'react-router-dom';
import { buildLoginUrl, useAuthStore } from '../store/authStore';
import { useProfileDialog } from '../store/profileDialogStore';

export default function Header() {
  const { user, isAuthenticated, signOut } = useAuthStore();
  const showProfile = useProfileDialog((s) => s.show);
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}`;

  return (
    <header className="flex items-center justify-between px-4 py-3 sm:px-6">
      <Link to="/" className="text-lg font-bold tracking-tight text-sky-300">
        도로 게임 천국
      </Link>
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
    </header>
  );
}
