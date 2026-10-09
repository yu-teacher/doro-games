package com.doro.games.domain.game;

import com.doro.games.common.exception.ErrorCode;
import com.doro.games.common.exception.GamesException;
import com.doro.games.common.response.ApiResponse;
import com.doro.games.domain.game.GameDtos.GameHighlight;
import com.doro.games.domain.game.GameDtos.GameResponse;
import com.doro.games.domain.game.GameDtos.LeaderboardResponse;
import com.doro.games.domain.game.GameDtos.MyRecordResponse;
import com.doro.games.domain.game.GameDtos.RunResponse;
import com.doro.games.domain.game.GameDtos.SetEnabledRequest;
import com.doro.games.domain.game.GameDtos.SubmitScoreRequest;
import com.doro.games.domain.game.GameDtos.SubmitScoreResponse;
import com.doro.games.infra.guard.GamesGuard;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.annotation.DoroGuard;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Tag(name = "1. Games (게임·기록·랭킹)", description = "게임 목록, 판 시작, 점수 제출, 랭킹")
@Validated
@RestController
@RequestMapping("/api/v1/games")
@RequiredArgsConstructor
public class GameController {

    private static final int DEFAULT_LEADERBOARD_SIZE = 20;
    private static final int MAX_LEADERBOARD_SIZE = 100;

    private final GameService gameService;

    @Operation(summary = "열려 있는 게임 목록 (공개)")
    @GetMapping
    public ApiResponse<List<GameResponse>> list() {
        return ApiResponse.success(gameService.list());
    }

    @Operation(summary = "로비 요약 (공개, 로그인하면 내 기록 포함)", description = "열린 게임마다 현재 1위와 내 최고 기록·순위. /{slug} 보다 먼저 매칭되므로 slug 로 highlights 를 쓸 수 없다")
    @GetMapping("/highlights")
    public ApiResponse<List<GameHighlight>> highlights(@CurrentDoroUser DoroUser doroUser) {
        return ApiResponse.success(gameService.highlights(doroUser));
    }

    @Operation(summary = "게임 한 개 (공개)")
    @GetMapping("/{slug}")
    public ApiResponse<GameResponse> get(@PathVariable("slug") String slug) {
        return ApiResponse.success(gameService.get(slug));
    }

    @Operation(summary = "게임 열기/닫기 (Guard: games_game#manager)")
    @DoroGuard(namespace = GamesGuard.GAME, object = "#slug", relation = GamesGuard.MANAGER)
    @PatchMapping("/{slug}")
    public ApiResponse<GameResponse> setEnabled(@PathVariable("slug") String slug, @Valid @RequestBody SetEnabledRequest request) {
        return ApiResponse.success(gameService.setEnabled(slug, request.enabled()));
    }

    @Operation(summary = "판 시작 (로그인)", description = "서버가 시작 시각을 기록한 판을 발급한다. 점수는 이 판으로만 한 번 제출할 수 있다")
    @PostMapping("/{slug}/runs")
    public ApiResponse<RunResponse> startRun(@PathVariable("slug") String slug, @CurrentDoroUser DoroUser doroUser) {
        requireLogin(doroUser);
        return ApiResponse.success(gameService.startRun(doroUser, slug));
    }

    @Operation(summary = "점수 제출 (로그인)", description = "판 시간 안에 낼 수 없는 점수는 400(SCORE-400-01)으로 거절한다")
    @PostMapping("/{slug}/runs/{runId}/score")
    public ApiResponse<SubmitScoreResponse> submitScore(
            @PathVariable("slug") String slug,
            @PathVariable("runId") UUID runId,
            @CurrentDoroUser DoroUser doroUser,
            @Valid @RequestBody SubmitScoreRequest request) {
        requireLogin(doroUser);
        return ApiResponse.success(gameService.submitScore(doroUser, slug, runId, request.score()));
    }

    @Operation(summary = "랭킹 (공개)", description = "사용자별 최고 기록 순. 같은 점수면 먼저 달성한 사람이 위")
    @GetMapping("/{slug}/leaderboard")
    public ApiResponse<LeaderboardResponse> leaderboard(
            @PathVariable("slug") String slug,
            @RequestParam(name = "limit", defaultValue = "" + DEFAULT_LEADERBOARD_SIZE) @Min(1) @Max(MAX_LEADERBOARD_SIZE) int limit) {
        return ApiResponse.success(gameService.leaderboard(slug, limit));
    }

    @Operation(summary = "내 기록 (로그인)", description = "기록이 없으면 data 가 비어 있다")
    @GetMapping("/{slug}/me")
    public ApiResponse<MyRecordResponse> myRecord(@PathVariable("slug") String slug, @CurrentDoroUser DoroUser doroUser) {
        return ApiResponse.success(gameService.myRecord(doroUser, slug).orElse(null));
    }

    private static void requireLogin(DoroUser doroUser) {
        if (!doroUser.isAuthenticated()) {
            throw new GamesException(ErrorCode.UNAUTHORIZED);
        }
    }
}
