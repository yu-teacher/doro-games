import { create } from 'zustand';

/** 프로필 수정 창을 어디서든(헤더, 로비 안내) 열 수 있게 하는 작은 상태 */
interface ProfileDialogState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useProfileDialog = create<ProfileDialogState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
