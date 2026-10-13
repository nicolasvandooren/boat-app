package com.boatapp.boat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(PostgresTestContainer.class)
class BoatRepositoryTest {

  @Autowired BoatRepository repository;
  @Autowired TestEntityManager entityManager;

  @Test
  void savesAndRetrievesBoat() {
    Boat saved = repository.saveAndFlush(new Boat("Black Pearl", "Fast three-master"));
    entityManager.clear();

    Boat found = repository.findById(saved.getId()).orElseThrow();

    assertThat(found.getName()).isEqualTo("Black Pearl");
    assertThat(found.getDescription()).isEqualTo("Fast three-master");
  }

  @Test
  void generatesIdAndCreatedAtOnSave() {
    Instant before = Instant.now().truncatedTo(ChronoUnit.MICROS);
    Boat boat = new Boat("Nautilus", null);
    assertThat(boat.getId()).isNull();
    assertThat(boat.getCreatedAt()).isNull();

    repository.saveAndFlush(boat);
    entityManager.clear();
    Boat found = repository.findById(boat.getId()).orElseThrow();

    assertThat(found.getId()).isNotNull();
    assertThat(found.getCreatedAt())
        .isEqualTo(boat.getCreatedAt())
        .isBetween(before, Instant.now());
    assertThat(found.getDescription()).isNull();
  }

  @Test
  void updateKeepsCreatedAt() {
    Boat saved = repository.saveAndFlush(new Boat("Old name", "Old description"));
    Instant createdAt = saved.getCreatedAt();
    entityManager.clear();

    Boat loaded = repository.findById(saved.getId()).orElseThrow();
    loaded.setName("New name");
    loaded.setDescription("New description");
    repository.saveAndFlush(loaded);
    entityManager.clear();

    Boat updated = repository.findById(saved.getId()).orElseThrow();
    assertThat(updated.getName()).isEqualTo("New name");
    assertThat(updated.getDescription()).isEqualTo("New description");
    assertThat(updated.getCreatedAt()).isEqualTo(createdAt);
  }

  @Test
  void rejectsMissingNameBeforeReachingTheDatabase() {
    assertThatThrownBy(() -> repository.saveAndFlush(new Boat(null, "No name")))
        .isInstanceOf(ConstraintViolationException.class)
        .hasMessageContaining("name");
  }

  @Test
  void rejectsBlankName() {
    assertThatThrownBy(() -> repository.saveAndFlush(new Boat("   ", null)))
        .isInstanceOf(ConstraintViolationException.class);
  }
}
