-- DORO Games V4: 2048 게임 추가 (게임 목록은 마이그레이션으로만 바꾼다)
INSERT INTO games (id, slug, title, description, sort_order) VALUES
    (gen_random_uuid(), '2048', '2048 타일', '같은 숫자를 밀어서 합치세요. 2048을 만들고도 계속 도전할 수 있어요.', 20);
