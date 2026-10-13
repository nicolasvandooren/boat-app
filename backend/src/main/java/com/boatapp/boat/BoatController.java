package com.boatapp.boat;

import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/boats")
public class BoatController {

  private final BoatService service;

  public BoatController(BoatService service) {
    this.service = service;
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
