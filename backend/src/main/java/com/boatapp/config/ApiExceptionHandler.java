package com.boatapp.config;

import java.util.List;
import java.util.Map;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Renders Spring MVC errors as {@code ProblemDetail}. Replaces Boot's default handler only to add
 * per-field messages to validation errors and to keep submitted values out of 400 responses. All
 * other exceptions keep the framework's default handling.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

  /** Invalid request body ({@code @Valid}). */
  @Override
  protected @Nullable ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    List<Map<String, String>> errors =
        ex.getFieldErrors().stream()
            .map(e -> fieldError(e.getField(), String.valueOf(e.getDefaultMessage())))
            .toList();
    return handleExceptionInternal(
        ex, validationProblem(ex.getBody(), errors), headers, status, request);
  }

  /** Constraint violations on request parameters, e.g. {@code @Min} on {@code page}. */
  @Override
  protected @Nullable ResponseEntity<Object> handleHandlerMethodValidationException(
      HandlerMethodValidationException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    List<Map<String, String>> errors =
        ex.getAllValidationResults().stream()
            .flatMap(
                result ->
                    result.getResolvableErrors().stream()
                        .map(
                            error ->
                                fieldError(
                                    String.valueOf(result.getMethodParameter().getParameterName()),
                                    String.valueOf(error.getDefaultMessage()))))
            .toList();
    return handleExceptionInternal(
        ex, validationProblem(ex.getBody(), errors), headers, status, request);
  }

  /**
   * Unparseable path or query values (e.g. {@code page=abc}, a non-UUID id). Spring's default
   * detail echoes the submitted value, so it is replaced.
   */
  @Override
  protected @Nullable ResponseEntity<Object> handleTypeMismatch(
      TypeMismatchException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
    List<Map<String, String>> errors =
        List.of(fieldError(String.valueOf(ex.getPropertyName()), "has an invalid format"));
    return handleExceptionInternal(
        ex, validationProblem(ProblemDetail.forStatus(status), errors), headers, status, request);
  }

  private static ProblemDetail validationProblem(
      ProblemDetail problem, List<Map<String, String>> errors) {
    problem.setTitle("Validation failed");
    problem.setDetail("One or more fields are invalid.");
    problem.setProperty("errors", errors);
    return problem;
  }

  private static Map<String, String> fieldError(String field, String message) {
    return Map.of("field", field, "message", message);
  }
}
