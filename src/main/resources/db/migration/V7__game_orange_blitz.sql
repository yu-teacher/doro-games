-- DORO Games V7: 귤 폭격 도로롱 추가 (게임 목록은 마이그레이션으로만 바꾼다)
INSERT INTO games (id, slug, title, description, sort_order) VALUES
    (gen_random_uuid(), 'orange-blitz', '귤 폭격 도로롱',
     '귤 탄을 쏘며 도로를 달려요. 게이트를 골라 화력을 키우고, 큰 숫자는 피하고 작은 숫자는 쏴서 부수며 달리세요. 10스테이지마다 나오는 근육 도로롱을 쓰러뜨리면 끝없이 이어져요. 한 방이면 끝!', 30);
