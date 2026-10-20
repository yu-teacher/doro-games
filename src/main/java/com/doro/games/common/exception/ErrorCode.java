package com.doro.games.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // 400 Bad Request
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "COMMON-400-01", "잘못된 입력값입니다."),
    SCORE_REJECTED(HttpStatus.BAD_REQUEST, "SCORE-400-01", "기록을 인정할 수 없습니다."),
    IDLE_CANNOT_AFFORD(HttpStatus.BAD_REQUEST, "IDLE-400-01", "귤이 모자라거나 더 키울 수 없어요."),

    // 401 Unauthorized
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "AUTH-401-01", "인증 자격 증명이 유효하지 않거나 누락되었습니다."),

    // 403 Forbidden
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "AUTH-403-01", "요청하신 리소스에 대한 접근 권한이 없습니다."),

    // 404 Not Found
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER-404-01", "존재하지 않는 사용자입니다."),
    GAME_NOT_FOUND(HttpStatus.NOT_FOUND, "GAME-404-01", "존재하지 않거나 열려 있지 않은 게임입니다."),
    RUN_NOT_FOUND(HttpStatus.NOT_FOUND, "RUN-404-01", "존재하지 않는 판입니다."),

    // 409 Conflict
    USERNAME_TAKEN(HttpStatus.CONFLICT, "USER-409-01", "이미 사용 중인 사용자명입니다."),
    DUPLICATE_RESOURCE(HttpStatus.CONFLICT, "COMMON-409-01", "이미 존재하는 리소스입니다."),
    RUN_ALREADY_FINISHED(HttpStatus.CONFLICT, "RUN-409-01", "이미 기록을 제출한 판입니다."),

    // 503 Service Unavailable
    SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "SYS-503-01", "권한 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."),

    // 500 Internal Server Error
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "SYS-500-01", "서버 내부 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
