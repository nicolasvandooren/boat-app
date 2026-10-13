package com.boatapp.boat;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Real PostgreSQL (same image as docker-compose.yml) so Flyway and schema validation run as in
 * production.
 */
@TestConfiguration(proxyBeanMethods = false)
class PostgresTestContainer {

  @Bean
  @ServiceConnection
  PostgreSQLContainer<?> postgres() {
    return new PostgreSQLContainer<>("postgres:17.9-alpine");
  }
}
