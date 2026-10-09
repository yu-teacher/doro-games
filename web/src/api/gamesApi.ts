import { apiClient } from './client';
import type { ApiEnvelope, Game, GameHighlight, Leaderboard, MyRecord, Run, SubmitScoreResult } from './types';

export async function listGames(signal?: AbortSignal): Promise<Game[]> {
  const response = await apiClient.get<ApiEnvelope<Game[]>>('/games', { signal });
  return response.data.data;
}

/** 로비 카드용: 열린 게임과 현재 1위, 로그인했다면 내 기록 */
export async function getHighlights(signal?: AbortSignal): Promise<GameHighlight[]> {
  const response = await apiClient.get<ApiEnvelope<GameHighlight[]>>('/games/highlights', { signal });
  return response.data.data;
}

export async function getGame(slug: string, signal?: AbortSignal): Promise<Game> {
  const response = await apiClient.get<ApiEnvelope<Game>>(`/games/${encodeURIComponent(slug)}`, { signal });
  return response.data.data;
}

export async function startRun(slug: string): Promise<Run> {
  const response = await apiClient.post<ApiEnvelope<Run>>(`/games/${encodeURIComponent(slug)}/runs`);
  return response.data.data;
}

export async function submitScore(slug: string, runId: string, score: number): Promise<SubmitScoreResult> {
  const response = await apiClient.post<ApiEnvelope<SubmitScoreResult>>(
    `/games/${encodeURIComponent(slug)}/runs/${encodeURIComponent(runId)}/score`,
    { score },
  );
  return response.data.data;
}

export async function getLeaderboard(slug: string, limit: number, signal?: AbortSignal): Promise<Leaderboard> {
  const response = await apiClient.get<ApiEnvelope<Leaderboard>>(`/games/${encodeURIComponent(slug)}/leaderboard`, {
    params: { limit },
    signal,
  });
  return response.data.data;
}

/** 기록이 없으면 null */
export async function getMyRecord(slug: string, signal?: AbortSignal): Promise<MyRecord | null> {
  const response = await apiClient.get<ApiEnvelope<MyRecord | null>>(`/games/${encodeURIComponent(slug)}/me`, { signal });
  return response.data.data ?? null;
}
