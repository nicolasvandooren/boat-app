package com.boatapp.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;

class TokenValidatorTest {

  private static final String ISSUER = "http://localhost:8081/realms/boatapp";
  private final OAuth2TokenValidator<Jwt> validator =
      SecurityConfig.tokenValidator(ISSUER, "boat-api");

  @Test
  void acceptsTokenWithExpectedIssuerAndAudience() {
    assertThat(validator.validate(token(ISSUER, List.of("boat-api", "account"))).hasErrors())
        .isFalse();
  }

  @Test
  void rejectsTokenFromAnotherIssuer() {
    assertThat(
            validator
                .validate(token("http://keycloak:8080/realms/boatapp", List.of("boat-api")))
                .hasErrors())
        .isTrue();
  }

  @Test
  void rejectsTokenWithoutApiAudience() {
    assertThat(validator.validate(token(ISSUER, List.of("account"))).hasErrors()).isTrue();
  }

  // The default JwtTimestampValidator allows 60 seconds of clock skew; 120 seconds is beyond it.

  @Test
  void rejectsExpiredToken() {
    Instant now = Instant.now();
    Jwt expired =
        validToken().issuedAt(now.minusSeconds(600)).expiresAt(now.minusSeconds(120)).build();

    assertThat(validator.validate(expired).hasErrors()).isTrue();
  }

  @Test
  void rejectsTokenThatIsNotYetValid() {
    Instant now = Instant.now();
    Jwt notYetValid =
        validToken()
            .issuedAt(now)
            .notBefore(now.plusSeconds(120))
            .expiresAt(now.plusSeconds(600))
            .build();

    assertThat(validator.validate(notYetValid).hasErrors()).isTrue();
  }

  private static Jwt.Builder validToken() {
    return Jwt.withTokenValue("token")
        .header("alg", "RS256")
        .issuer(ISSUER)
        .audience(List.of("boat-api"))
        .subject("user-1");
  }

  private static Jwt token(String issuer, List<String> audience) {
    Instant now = Instant.now();
    return Jwt.withTokenValue("token")
        .header("alg", "RS256")
        .issuer(issuer)
        .audience(audience)
        .subject("user-1")
        .issuedAt(now)
        .expiresAt(now.plusSeconds(60))
        .build();
  }
}
