package com.doro.games.domain.idle;

import com.doro.games.common.exception.ErrorCode;
import com.doro.games.common.exception.GamesException;
import com.doro.games.common.response.ApiResponse;
import com.doro.games.domain.idle.IdleDtos.BuyRequest;
import com.doro.games.domain.idle.IdleDtos.IdleView;
import com.doro.games.domain.idle.IdleDtos.TapRequest;
import com.hunnit_beasts.doro.sdk.annotation.CurrentDoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "2. Idle (도로롱 귤농장)", description = "방치형 게임: 진행 상황을 서버가 저장하고 계산한다")
@Validated
@RestController
@RequestMapping("/api/v1/idle")
@RequiredArgsConstructor
public class IdleController {

    private final IdleService idleService;

    @Operation(summary = "내 농장 (로그인)", description = "자리를 비운 동안의 생산을 정산해서 돌려준다(최대 8시간)")
    @GetMapping
    public ApiResponse<IdleView> view(@CurrentDoroUser DoroUser doroUser) {
        requireLogin(doroUser);
        return ApiResponse.success(idleService.view(doroUser));
    }

    @Operation(summary = "귤 따기 (로그인)", description = "사람이 누를 수 있는 속도(초당 15, 한꺼번에 100)까지만 인정한다")
    @PostMapping("/tap")
    public ApiResponse<IdleView> tap(@CurrentDoroUser DoroUser doroUser, @Valid @RequestBody TapRequest request) {
        requireLogin(doroUser);
        return ApiResponse.success(idleService.tap(doroUser, request.count()));
    }

    @Operation(summary = "도로롱 키우기/부르기 (로그인)", description = "amount(1, 10, 100)번까지, 귤이 되는 만큼 산다. 하나도 못 사면 400(IDLE-400-01)")
    @PostMapping("/producers/{index}/buy")
    public ApiResponse<IdleView> buyProducer(@CurrentDoroUser DoroUser doroUser, @PathVariable("index") int index, @Valid @RequestBody BuyRequest request) {
        requireLogin(doroUser);
        return ApiResponse.success(idleService.buyProducer(doroUser, index, request.amount()));
    }

    @Operation(summary = "귤 따기 장갑 키우기 (로그인)")
    @PostMapping("/tap-upgrade/buy")
    public ApiResponse<IdleView> buyTapUpgrade(@CurrentDoroUser DoroUser doroUser, @Valid @RequestBody BuyRequest request) {
        requireLogin(doroUser);
        return ApiResponse.success(idleService.buyTapUpgrade(doroUser, request.amount()));
    }

    private static void requireLogin(DoroUser doroUser) {
        if (!doroUser.isAuthenticated()) {
            throw new GamesException(ErrorCode.UNAUTHORIZED);
        }
    }
}
