package com.boatapp.me;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boatapp.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MeController.class)
@Import(SecurityConfig.class)
@TestPropertySource(
    properties = {
      "app.security.issuer-uri=http://issuer.test/realms/boatapp",
      "app.security.jwk-set-uri=http://issuer.test/certs",
      "app.security.audience=boat-api"
    })
class MeControllerTest {

  @Autowired MockMvc mvc;

  @Test
  void rejectsAnonymousRequests() throws Exception {
    mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void returnsCallerIdentity() throws Exception {
    mvc.perform(
            get("/api/me")
                .with(jwt().jwt(j -> j.subject("user-1").claim("preferred_username", "demo"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.subject").value("user-1"))
        .andExpect(jsonPath("$.username").value("demo"));
  }

  @Test
  void securesUnknownPathsByDefault() throws Exception {
    mvc.perform(get("/anything")).andExpect(status().isUnauthorized());
  }
}
