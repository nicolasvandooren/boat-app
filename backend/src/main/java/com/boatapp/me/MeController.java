package com.boatapp.me;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Returns the identity of the caller; used to verify the browser → Keycloak → API chain. */
@RestController
@RequestMapping("/api/me")
public class MeController {

  @GetMapping
  public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
    return new MeResponse(jwt.getSubject(), jwt.getClaimAsString("preferred_username"));
  }

  public record MeResponse(String subject, String username) {}
}
