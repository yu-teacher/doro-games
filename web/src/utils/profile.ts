import type { UserProfile } from '../api/types';

/** 서버(UsernamePolicy, UpdateProfileRequest)와 같은 규칙. 서버가 최종 판정하고, 여기서는 보내기 전에 안내만 한다. */
export const NICKNAME_MAX = 20;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

const USERNAME_FORMAT = new RegExp(`^[a-z0-9_]{${USERNAME_MIN},${USERNAME_MAX}}$`);

/** 앞뒤 공백과 앞의 @ 를 떼고 소문자로 바꾼다(서버의 정리 규칙과 같다). */
export function normalizeUsername(raw: string): string {
  const value = raw.trim();
  return (value.startsWith('@') ? value.slice(1) : value).toLowerCase();
}

/** 문제가 있으면 안내 문구, 없으면 null */
export function validateNickname(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) {
    return '닉네임을 입력해 주세요.';
  }
  if ([...value].length > NICKNAME_MAX) {
    return `닉네임은 ${NICKNAME_MAX}자 이하로 정해 주세요.`;
  }
  if ([...value].some((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 0x20 || (code >= 0x7f && code < 0xa0);
  })) {
    return '닉네임에 사용할 수 없는 문자가 있어요.';
  }
  return null;
}

export function validateUsername(raw: string): string | null {
  const value = normalizeUsername(raw);
  if (!USERNAME_FORMAT.test(value)) {
    return `사용자명은 ${USERNAME_MIN}~${USERNAME_MAX}자의 영문 소문자, 숫자, '_' 만 쓸 수 있어요.`;
  }
  return null;
}

/** 처음 가입하면 닉네임이 임시 사용자명과 같다. 다른 사람에게 보이는 이름이므로 정하도록 안내한다. */
export function hasDefaultNickname(user: UserProfile | null): boolean {
  return user !== null && user.nickname === user.username;
}
