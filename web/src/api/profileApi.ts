import { apiClient } from './client';
import type { ApiEnvelope, UserProfile } from './types';

/** 닉네임·사용자명을 바꾼다. 형식 오류(400)·이미 쓰는 사용자명(409)은 서버의 안내 문구를 담은 ApiError 로 던진다. */
export async function updateProfile(nickname: string, username: string): Promise<UserProfile> {
  const response = await apiClient.patch<ApiEnvelope<UserProfile>>('/me', { nickname, username });
  return response.data.data;
}
