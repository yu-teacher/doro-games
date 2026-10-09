package com.doro.games.infra.guard;

/** Guard 스키마(games-schema.doro)의 타입·관계 이름. {@code @DoroGuard} 에 쓰려면 컴파일 상수여야 한다. */
public final class GamesGuard {

    public static final String GAME = "games_game";
    public static final String USER = "user";

    public static final String ADMIN = "admin";
    public static final String MANAGER = "manager";

    private GamesGuard() {
    }
}
