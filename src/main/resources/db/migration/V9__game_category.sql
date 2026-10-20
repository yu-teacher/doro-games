-- DORO Games V9: 게임 종류(category). 로비가 "미니게임"(한 판씩 점수를 겨루는 게임)과 "오래 즐기는 게임"(진행 상황이 이어지는 게임)을 나눠 보여 준다.
ALTER TABLE games ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'minigame';
UPDATE games SET category = 'longplay' WHERE slug = 'orange-farm';
ALTER TABLE games ADD CONSTRAINT games_category_check CHECK (category IN ('minigame', 'longplay'));
