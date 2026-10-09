import axios from 'axios';
import { API_BASE } from '../config';
import { useAuthStore } from '../store/authStore';
import { CSRF_HEADER, CSRF_VALUE } from './csrf';

/** 로그인은 서버가 관리하는 세션 쿠키(HttpOnly)로 이루어진다. 같은 사이트 요청에는 브라우저가 쿠키를 알아서 붙인다. */
export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    [CSRF_HEADER]: CSRF_VALUE,
  },
});

interface ErrorBody {
  code?: string;
  message?: string;
  error?: { message?: string };
}

/** 서버의 표준 오류 규격(code/message)을 담은 오류. 화면은 code 로 분기하고 message 를 그대로 보여 준다. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }
    if (axios.isAxiosError<ErrorBody>(error)) {
      // 401: 세션이 끝났다. 화면 상태를 비로그인으로 맞춘다(갑자기 다른 화면으로 보내지 않는다)
      if (error.response?.status === 401) {
        useAuthStore.getState().markSignedOut();
      }
      const body = error.response?.data;
      const message = body?.message || body?.error?.message || error.message || '요청 처리 중 오류가 발생했습니다.';
      return Promise.reject(new ApiError(message, error.response?.status ?? null, body?.code ?? null));
    }
    return Promise.reject(error instanceof Error ? error : new Error('요청 처리 중 오류가 발생했습니다.'));
  },
);
