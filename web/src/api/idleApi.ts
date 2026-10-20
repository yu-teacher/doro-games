import { apiClient } from './client';
import type { ApiEnvelope, IdleView } from './types';

export async function getIdle(signal?: AbortSignal): Promise<IdleView> {
  const response = await apiClient.get<ApiEnvelope<IdleView>>('/idle', { signal });
  return response.data.data;
}

export async function tapIdle(count: number): Promise<IdleView> {
  const response = await apiClient.post<ApiEnvelope<IdleView>>('/idle/tap', { count });
  return response.data.data;
}

export async function buyProducer(index: number, amount: number): Promise<IdleView> {
  const response = await apiClient.post<ApiEnvelope<IdleView>>(`/idle/producers/${index}/buy`, { amount });
  return response.data.data;
}

export async function buyTapUpgrade(amount: number): Promise<IdleView> {
  const response = await apiClient.post<ApiEnvelope<IdleView>>('/idle/tap-upgrade/buy', { amount });
  return response.data.data;
}
