package com.boatapp.boat;

import java.time.Instant;
import java.util.UUID;

public record BoatResponse(UUID id, String name, String description, Instant createdAt) {

  static BoatResponse from(Boat boat) {
    return new BoatResponse(
        boat.getId(), boat.getName(), boat.getDescription(), boat.getCreatedAt());
  }
}
