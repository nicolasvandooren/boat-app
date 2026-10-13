package com.boatapp.boat;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.ErrorResponseException;

/** Rendered by Spring MVC as a 404 {@code ProblemDetail}. */
public class BoatNotFoundException extends ErrorResponseException {

  public BoatNotFoundException(UUID id) {
    super(HttpStatus.NOT_FOUND);
    getBody().setTitle("Boat not found");
    getBody().setDetail("No boat with id " + id);
  }
}
