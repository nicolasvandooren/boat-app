package com.boatapp.boat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Unexpected exceptions must surface as 500, not as 401. MockMvc cannot show this: it has no
 * servlet container, so Tomcat's error dispatch to {@code /error}, which passes through the Spring
 * Security filter chain again, only happens on a real server.
 *
 * <p>The real {@code SecurityConfig} filter chain is used. Only the {@code JwtDecoder} is mocked,
 * so no Keycloak is needed; issuer and audience validation are covered by {@code
 * TokenValidatorTest}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestContainer.class)
class UnexpectedErrorDispatchTest {

  private static final String SECRET = "S3CR3T-internal-detail select * from boats";

  @Autowired TestRestTemplate http;
  @MockitoBean BoatService service;
  @MockitoBean JwtDecoder jwtDecoder;

  @Test
  void unexpectedExceptionInAuthenticatedRequestReturns500WithoutInternals() {
    given(jwtDecoder.decode("valid-token")).willReturn(jwt("valid-token"));
    given(service.get(any())).willThrow(new IllegalStateException(SECRET));

    ResponseEntity<String> response = get("/api/boats/" + UUID.randomUUID(), "valid-token");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    assertThat(response.getBody())
        .isNotNull()
        // Rendered by Spring Boot's /error endpoint, i.e. the container error dispatch happened and
        // passed the security filter chain.
        .contains("\"status\":500", "\"error\":\"Internal Server Error\"")
        .doesNotContain(SECRET, "S3CR3T", "IllegalStateException", "select", "\tat ")
        .doesNotContain("java.", "com.boatapp", "org.springframework", "trace");
  }

  @Test
  void sameEndpointWithoutTokenStillReturns401() {
    ResponseEntity<String> response = get("/api/boats/" + UUID.randomUUID(), null);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  private ResponseEntity<String> get(String path, String token) {
    HttpHeaders headers = new HttpHeaders();
    if (token != null) {
      headers.setBearerAuth(token);
    }
    return http.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), String.class);
  }

  private static Jwt jwt(String tokenValue) {
    Instant now = Instant.now();
    return Jwt.withTokenValue(tokenValue)
        .header("alg", "RS256")
        .subject("user-1")
        .claim("preferred_username", "demo")
        .issuedAt(now)
        .expiresAt(now.plusSeconds(300))
        .build();
  }
}
