/** Vite `base`(/games/). 게이트웨이의 하위 경로 마운트와 같아야 한다. */
const BASE_URL = import.meta.env.BASE_URL;

/** 라우터 basename: 끝의 슬래시를 뗀 경로(/games). */
export const ROUTER_BASENAME = BASE_URL.replace(/\/+$/, '');

/** 백엔드 API 기준 경로(/games/api/v1). 게이트웨이가 /games 를 떼고 백엔드로 전달한다. */
export const API_BASE = `${BASE_URL}api/v1`;

/** 랭킹 화면에 보여 줄 순위 개수 */
export const LEADERBOARD_SIZE = 10;
