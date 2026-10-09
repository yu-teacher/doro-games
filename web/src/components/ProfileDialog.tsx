import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useProfileDialog } from '../store/profileDialogStore';
import { NICKNAME_MAX, USERNAME_MAX, normalizeUsername, validateNickname, validateUsername } from '../utils/profile';

/** 닉네임·사용자명 수정 창. 브라우저 기본 <dialog> 라서 Esc 로 닫히고 포커스가 창 안에 머문다. */
export default function ProfileDialog() {
  const { open, hide } = useProfileDialog();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      setNickname(user?.nickname ?? '');
      setUsername(user?.username ?? '');
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateNickname(nickname) ?? validateUsername(username);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile(nickname.trim(), normalizeUsername(username));
      hide();
    } catch (e) {
      console.warn('Profile update failed', e);
      setError(e instanceof ApiError || e instanceof Error ? e.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={hide}
      onClick={(e) => {
        // 창 바깥(배경)을 누르면 닫는다
        if (e.target === dialogRef.current) {
          hide();
        }
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/60"
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4 p-6">
        <h2 className="text-lg font-bold">내 프로필</h2>

        <label className="block text-sm">
          <span className="text-slate-300">닉네임</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={NICKNAME_MAX * 2}
            autoComplete="nickname"
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 outline-none focus:border-sky-400"
          />
          <span className="mt-1 block text-xs text-slate-500">랭킹에 보이는 이름이에요. {NICKNAME_MAX}자까지.</span>
        </label>

        <label className="block text-sm">
          <span className="text-slate-300">사용자명</span>
          <div className="mt-1 flex items-center rounded-lg border border-slate-600 bg-slate-950 focus-within:border-sky-400">
            <span className="pl-3 text-slate-500">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={USERNAME_MAX + 1}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent px-1.5 py-2 outline-none"
            />
          </div>
          <span className="mt-1 block text-xs text-slate-500">영문 소문자, 숫자, _ 로 3~30자. 나를 찾는 고유한 이름이에요.</span>
        </label>

        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-rose-300">
          {error}
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={hide} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
