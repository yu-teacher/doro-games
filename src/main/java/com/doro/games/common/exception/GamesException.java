package com.doro.games.common.exception;

import lombok.Getter;

@Getter
public class GamesException extends RuntimeException {

    private final ErrorCode errorCode;

    public GamesException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public GamesException(ErrorCode errorCode, String detailMessage) {
        super(detailMessage);
        this.errorCode = errorCode;
    }
}
