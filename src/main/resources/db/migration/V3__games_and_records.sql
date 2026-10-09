-- DORO Games V3: 게임 카탈로그, 판(run), 사용자별 최고 기록
-- 점수는 서버가 발급한 판(game_runs)에 묶여서만 제출할 수 있다(한 판에 한 번).

CREATE TABLE games (
    id UUID PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_runs (
    id UUID PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id),
    user_id UUID NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_game_runs_user ON game_runs(user_id, started_at DESC);

-- 사용자·게임별 최고 기록 한 줄. 랭킹은 이 표만 읽는다.
CREATE TABLE game_records (
    game_id UUID NOT NULL REFERENCES games(id),
    user_id UUID NOT NULL,
    best_score BIGINT NOT NULL,
    plays INT NOT NULL DEFAULT 1,
    achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, user_id)
);
CREATE INDEX idx_game_records_rank ON game_records(game_id, best_score DESC, achieved_at ASC);

INSERT INTO games (id, slug, title, description, sort_order) VALUES
    (gen_random_uuid(), 'runner', '도로 러너', '달리는 도로 위의 장애물을 점프와 숙이기로 피하세요. 오래 달릴수록 빨라집니다.', 10);
