package com.doro.games.domain.idle;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
class IdleConfig {

    /** 정산에 쓰는 서버 시계(시험에서는 시간을 앞으로 돌리는 시계로 바꿔 끼운다) */
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean(Clock.class)
    Clock clock() {
        return Clock.systemUTC();
    }
}
