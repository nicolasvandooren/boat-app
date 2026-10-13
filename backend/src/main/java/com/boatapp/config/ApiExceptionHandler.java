package com.boatapp.config;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Renders Spring MVC errors as {@code ProblemDetail}. Replaces Boot's default handler only to add
 * per-field messages to validation errors.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

  @Override
  protected @Nullable ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    ProblemDetail problem = ex.getBody();
    problem.setTitle("Validation failed");
    problem.setDetail("One or more fields are invalid.");
    List<Map<String, String>> errors =
        ex.getFieldErrors().stream()
            .map(
                e ->
                    Map.of("field", e.getField(), "message", String.valueOf(e.getDefaultMessage())))
            .toList();
    problem.setProperty("errors", errors);
    return handleExceptionInternal(ex, problem, headers, status, request);
  }
}
