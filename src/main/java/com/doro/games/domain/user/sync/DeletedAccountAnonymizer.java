package com.doro.games.domain.user.sync;

import com.doro.games.domain.auth.repository.AuthSessionRepository;
import com.doro.games.domain.user.entity.GameUser;
import com.doro.games.domain.user.repository.GameUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Doro 에서 영구 탈퇴한 사용자의 게임 프로필 개인정보(사용자명·닉네임)를 익명화한다. 개인정보는 {@code game_users} 에만 있고
 * 판(game_runs)·최고 기록(game_records)은 사용자 ID 만 가지므로, 행을 남기면 순위표에는 점수가 남고 이름은 '탈퇴한 사용자' 로 보인다.
 * 사용자 본인에게만 의미 있던 데이터인 BFF 세션(embedded 모드의 저장소, gateway 모드에서는 비어 있음)은 지운다.
 * 이미 처리한 사용자에게 다시 호출해도 아무것도 바꾸지 않는다(멱등).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeletedAccountAnonymizer {

    static final String PLACEHOLDER_NICKNAME = "탈퇴한 사용자";

    private final GameUserRepository users;
    private final AuthSessionRepository authSessions;

    /** @return 이번 호출에서 익명화했으면 true, 게임 사용자가 아니거나 이미 처리됐으면 false */
    @Transactional
    public boolean anonymize(UUID userId, Instant now) {
        GameUser user = users.findByIdForUpdate(userId).orElse(null);
        if (user == null || user.isDeleted()) {
            return false;
        }
        // 사용자명은 유일해야 하므로 ID 에서 만든 값으로 바꾼다(길이 8 + 32 = 40 <= 50).
        user.anonymize("deleted-" + userId.toString().replace("-", ""), PLACEHOLDER_NICKNAME, now);
        authSessions.deleteAllByUserId(userId);
        log.info("Game profile anonymized after Doro account deletion: userId={}", userId);
        return true;
    }
}
