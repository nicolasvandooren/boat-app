package com.boatapp.boat;

import java.util.List;
import org.springframework.data.domain.Page;

/** Stable pagination contract; Spring Data's {@code Page} JSON is deliberately not exposed. */
public record BoatPageResponse(
    List<BoatResponse> content, int page, int size, long totalElements, int totalPages) {

  static BoatPageResponse from(Page<Boat> page) {
    return new BoatPageResponse(
        page.map(BoatResponse::from).getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages());
  }
}
