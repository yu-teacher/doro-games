-- DORO Games V8: 도로롱 귤농장(방치형) 추가. 진행 상황은 서버가 저장하고 계산한다(클라이언트가 보낸 값을 믿지 않는다).
INSERT INTO games (id, slug, title, description, sort_order) VALUES
    (gen_random_uuid(), 'orange-farm', '도로롱 귤농장',
     '귤이 저절로 쌓여요. 귤로 도로롱을 불러 모으고, 의상 도로롱을 도감에 채워 보세요. 자리를 비워도 귤은 계속 열려요(최대 8시간).', 40);

-- 사용자별 농장 한 줄. 귤 수·누적 귤·레벨은 모두 서버가 계산한 값이다.
CREATE TABLE idle_saves (
    user_id UUID PRIMARY KEY,
    oranges BIGINT NOT NULL DEFAULT 0,
    total_earned BIGINT NOT NULL DEFAULT 0,
    tap_level INT NOT NULL DEFAULT 0,
    -- 도로롱 종류별 레벨(쉼표로 구분, 종류 순서대로)
    levels TEXT NOT NULL,
    -- 여기까지 생산을 정산했다(이후 시간은 아직 귤로 바뀌지 않았다)
    settled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- 탭 속도 제한용 예산(탭 수 × 1000)과 그 기준 시각
    tap_budget_milli BIGINT NOT NULL,
    tap_budget_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
