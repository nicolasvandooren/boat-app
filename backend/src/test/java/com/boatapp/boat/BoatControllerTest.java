package com.boatapp.boat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.aMapWithSize;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boatapp.config.SecurityConfig;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(BoatController.class)
@Import(SecurityConfig.class)
@TestPropertySource(
    properties = {
      "app.security.issuer-uri=http://issuer.test/realms/boatapp",
      "app.security.jwk-set-uri=http://issuer.test/certs",
      "app.security.audience=boat-api"
    })
class BoatControllerTest {

  private static final UUID ID = UUID.fromString("7d0f3c1e-2b5a-4c8e-9f10-1a2b3c4d5e6f");
  private static final BoatResponse BOAT =
      new BoatResponse(ID, "Nautilus", "Submarine", Instant.parse("2026-10-13T10:00:00Z"));

  @Autowired MockMvc mvc;
  @MockitoBean BoatService service;

  @Test
  void getReturnsBoat() throws Exception {
    given(service.get(ID)).willReturn(BOAT);

    mvc.perform(authenticated(get("/api/boats/{id}", ID)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(ID.toString()))
        .andExpect(jsonPath("$.name").value("Nautilus"))
        .andExpect(jsonPath("$.description").value("Submarine"))
        .andExpect(jsonPath("$.createdAt").value("2026-10-13T10:00:00Z"));
  }

  @Test
  void createReturns201WithLocation() throws Exception {
    given(service.create(new BoatRequest("Nautilus", "Submarine"))).willReturn(BOAT);

    mvc.perform(
            authenticated(post("/api/boats"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"  Nautilus  \",\"description\":\"Submarine\"}"))
        .andExpect(status().isCreated())
        .andExpect(header().string("Location", "/api/boats/" + ID))
        .andExpect(jsonPath("$.id").value(ID.toString()));
  }

  @Test
  void createIgnoresServerManagedFields() throws Exception {
    given(service.create(new BoatRequest("Nautilus", null))).willReturn(BOAT);

    mvc.perform(
            authenticated(post("/api/boats"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"id\":\"00000000-0000-0000-0000-000000000001\","
                        + "\"createdAt\":\"2000-01-01T00:00:00Z\",\"name\":\"Nautilus\"}"))
        .andExpect(status().isCreated());

    verify(service).create(new BoatRequest("Nautilus", null));
  }

  @Test
  void updateReturnsUpdatedBoat() throws Exception {
    given(service.update(eq(ID), eq(new BoatRequest("Nautilus", "Submarine")))).willReturn(BOAT);

    mvc.perform(
            authenticated(put("/api/boats/{id}", ID))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Nautilus\",\"description\":\"Submarine\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Nautilus"));
  }

  @Test
  void deleteReturns204() throws Exception {
    mvc.perform(authenticated(delete("/api/boats/{id}", ID))).andExpect(status().isNoContent());

    verify(service).delete(ID);
  }

  @Test
  void missingBoatReturns404ProblemDetail() throws Exception {
    given(service.get(ID)).willThrow(new BoatNotFoundException(ID));
    given(service.update(eq(ID), any())).willThrow(new BoatNotFoundException(ID));
    willThrow(new BoatNotFoundException(ID)).given(service).delete(ID);

    mvc.perform(authenticated(get("/api/boats/{id}", ID)))
        .andExpect(status().isNotFound())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.title").value("Boat not found"));
    mvc.perform(
            authenticated(put("/api/boats/{id}", ID))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Nautilus\"}"))
        .andExpect(status().isNotFound());
    mvc.perform(authenticated(delete("/api/boats/{id}", ID))).andExpect(status().isNotFound());
  }

  @Test
  void invalidInputReturns400WithFieldErrors() throws Exception {
    String body = "{\"name\":\"   \",\"description\":\"" + "x".repeat(2001) + "\"}";

    mvc.perform(
            authenticated(post("/api/boats")).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.title").value("Validation failed"))
        .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("name", "description")));
    verifyNoInteractions(service);
  }

  @Test
  void nameLongerThan150CharactersIsRejected() throws Exception {
    mvc.perform(
            authenticated(put("/api/boats/{id}", ID))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + "x".repeat(151) + "\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("name"));
    verifyNoInteractions(service);
  }

  @Test
  void malformedRequestsReturn400() throws Exception {
    mvc.perform(
            authenticated(post("/api/boats")).contentType(MediaType.APPLICATION_JSON).content("{"))
        .andExpect(status().isBadRequest());
    mvc.perform(authenticated(get("/api/boats/not-a-uuid"))).andExpect(status().isBadRequest());
    verifyNoInteractions(service);
  }

  @Test
  void unauthenticatedRequestsReturn401() throws Exception {
    mvc.perform(get("/api/boats/{id}", ID)).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/boats").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            put("/api/boats/{id}", ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"x\"}"))
        .andExpect(status().isUnauthorized());
    mvc.perform(delete("/api/boats/{id}", ID)).andExpect(status().isUnauthorized());
    verifyNoInteractions(service);
  }

  @Test
  void validationErrorsDoNotLeakSubmittedValuesOrInternals() throws Exception {
    String secret = "S3CR3T-cc-4111111111111111";
    String name = secret.repeat(10); // > 150 characters
    String description = secret.repeat(100); // > 2000 characters

    String body =
        mvc.perform(
                authenticated(post("/api/boats"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\",\"description\":\"" + description + "\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.status").value(400))
            .andExpect(jsonPath("$.title").value("Validation failed"))
            .andExpect(jsonPath("$.detail").value("One or more fields are invalid."))
            .andExpect(jsonPath("$.instance").value("/api/boats"))
            .andExpect(jsonPath("$.errors", hasSize(2)))
            .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("name", "description")))
            .andExpect(jsonPath("$.errors[0]", aMapWithSize(2)))
            .andExpect(jsonPath("$.errors[1]", aMapWithSize(2)))
            .andExpect(
                jsonPath("$.errors[*].message", everyItem(startsWith("size must be between"))))
            .andExpect(jsonPath("$.trace").doesNotExist())
            .andExpect(jsonPath("$.exception").doesNotExist())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(body)
        .doesNotContain(secret)
        .doesNotContainIgnoringCase("rejected")
        .doesNotContain("BoatRequest", "Exception", "java.", "jakarta.", "org.springframework")
        .doesNotContain("\tat ", "Caused by")
        .doesNotContainIgnoringCase("sql")
        .doesNotContainIgnoringCase("postgres")
        .doesNotContainIgnoringCase("hibernate")
        .doesNotContainIgnoringCase("jdbc");
    verifyNoInteractions(service);
  }

  private static MockHttpServletRequestBuilder authenticated(
      MockHttpServletRequestBuilder request) {
    return request.with(jwt());
  }
}
