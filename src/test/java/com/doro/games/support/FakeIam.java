package com.doro.games.support;

import io.jsonwebtoken.Jwts;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.util.Date;
import java.util.UUID;

/**
 * 테스트용 가짜 Doro IAM 서명 키. 운영에서 게이트웨이가 붙여 주는 것과 같은 모양의 RS256 액세스 토큰을 발급한다.
 * 로그인(인가 코드 교환·갱신)은 이 서비스가 하지 않으므로(별도 BFF 가 한다) HTTP 엔드포인트는 흉내 내지 않는다.
 */
public final class FakeIam {

    public static final String KID = "fake-iam-kid";

    private final KeyPair keyPair;

    public FakeIam() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
            gen.initialize(2048);
            keyPair = gen.generateKeyPair();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public PublicKey publicKey() {
        return keyPair.getPublic();
    }

    /** 유효한 액세스 토큰(15분). */
    public String accessToken(UUID userId, String email, String clientId) {
        long now = System.currentTimeMillis();
        return token(userId, email, clientId, now, now + 900_000);
    }

    /** 이미 만료된 액세스 토큰(서명은 유효). */
    public String expiredAccessToken(UUID userId, String email, String clientId) {
        long now = System.currentTimeMillis();
        return token(userId, email, clientId, now - 7_200_000, now - 3_600_000);
    }

    private String token(UUID userId, String email, String clientId, long issuedAt, long expiresAt) {
        return Jwts.builder()
                .header().keyId(KID).and()
                .subject(userId.toString())
                .claim("email", email)
                .claim("sid", UUID.randomUUID().toString())
                .claim("role", "USER")
                .claim("cid", clientId)
                .issuedAt(new Date(issuedAt))
                .expiration(new Date(expiresAt))
                .signWith(keyPair.getPrivate(), Jwts.SIG.RS256)
                .compact();
    }
}
