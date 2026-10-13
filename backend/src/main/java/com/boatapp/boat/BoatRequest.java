package com.boatapp.boat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Client-writable boat fields. {@code id} and {@code createdAt} are deliberately absent: unknown
 * JSON properties are ignored, so clients cannot set them.
 */
public record BoatRequest(
    @NotBlank @Size(max = 150) String name, @Size(max = 2000) String description) {

  public BoatRequest {
    // Trim before validation runs, so "  " is blank and the length limit applies to the stored
    // value.
    name = name == null ? null : name.strip();
  }
}
