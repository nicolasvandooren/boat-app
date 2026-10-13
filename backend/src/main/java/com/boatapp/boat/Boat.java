package com.boatapp.boat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Entity
@Table(name = "boats")
public class Boat {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotBlank
  @Size(max = 150)
  @Column(nullable = false, length = 150)
  private String name;

  @Size(max = 2000)
  @Column(length = 2000)
  private String description;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected Boat() {}

  public Boat(String name, String description) {
    this.name = name;
    this.description = description;
  }

  @PrePersist
  void onCreate() {
    // PostgreSQL stores microseconds; truncating keeps in-memory and stored values equal.
    createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
