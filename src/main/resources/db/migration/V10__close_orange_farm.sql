-- DORO Games V10: 도로롱 귤농장(방치형)을 닫는다. 기획부터 다시 하기로 해서 로비와 API 에서 내리고,
-- 코드와 저장된 데이터(idle_saves)는 그대로 둔다. 다시 열려면 enabled 를 true 로 되돌리는 마이그레이션을 추가한다.
UPDATE games SET enabled = FALSE WHERE slug = 'orange-farm';
