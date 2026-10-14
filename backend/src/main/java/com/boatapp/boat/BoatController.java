package com.boatapp.boat;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/boats")
public class BoatController {

  private final BoatService service;

  public BoatController(BoatService service) {
    this.service = service;
  }

  /**
   * Deliberate API limit: with the maximum page size of 100, {@code page * size} always fits JPA's
   * {@code int} offset. Beyond it Spring Data throws instead of returning an empty page.
   */
  static final int MAX_PAGE = Integer.MAX_VALUE / 100;

  /** Constraint violations are reported by Spring MVC's built-in method validation as 400. */
  @GetMapping
  public BoatPageResponse list(
      @RequestParam(defaultValue = "0") @Min(0) @Max(MAX_PAGE) int page,
      @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
      @RequestParam(required = false)
          @Pattern(regexp = BoatRequest.NO_NUL, message = BoatRequest.NO_NUL_MESSAGE)
          String search) {
    return service.list(page, size, search);
  }

  @GetMapping("/{id}")
  public BoatResponse get(@PathVariable UUID id) {
    return service.get(id);
  }

  @PostMapping
  public ResponseEntity<BoatResponse> create(@Valid @RequestBody BoatRequest request) {
    BoatResponse created = service.create(request);
    // Relative Location: correct behind the nginx proxy without forwarded-header configuration.
    return ResponseEntity.created(URI.create("/api/boats/" + created.id())).body(created);
  }

  @PutMapping("/{id}")
  public BoatResponse update(@PathVariable UUID id, @Valid @RequestBody BoatRequest request) {
    return service.update(id, request);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }
}
