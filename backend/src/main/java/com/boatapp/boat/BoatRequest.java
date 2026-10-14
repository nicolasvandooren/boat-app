package com.boatapp.boat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Client-writable boat fields. {@code id} and {@code createdAt} are deliberately absent: unknown
 * JSON properties are ignored, so clients cannot set them.
 */
public record BoatRequest(
    @NotBlank @Size(max = 150) @Pattern(regexp = NO_NUL, message = NO_NUL_MESSAGE) String name,
    @Size(max = 2000) @Pattern(regexp = NO_NUL, message = NO_NUL_MESSAGE) String description) {

  /** PostgreSQL text cannot store U+0000; rejecting it here turns a database error into a 400. */
  static final String NO_NUL = "[^\\x00]*";

  static final String NO_NUL_MESSAGE = "must not contain NUL characters";

  public BoatRequest {
    // Trim before validation runs, so "  " is blank and the length limit applies to the stored
    // value.
    name = name == null ? null : name.strip();
  }
}
