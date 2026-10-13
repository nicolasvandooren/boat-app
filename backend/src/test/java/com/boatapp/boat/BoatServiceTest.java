package com.boatapp.boat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({BoatService.class, PostgresTestContainer.class})
class BoatServiceTest {

  @Autowired BoatService service;
  @Autowired BoatRepository repository;
  @Autowired TestEntityManager entityManager;

  @Test
  void createsAndReadsBoat() {
    BoatResponse created = service.create(new BoatRequest("  Nautilus ", "Submarine"));
    entityManager.flush();
    entityManager.clear();

    BoatResponse found = service.get(created.id());

    assertThat(found).isEqualTo(created);
    assertThat(found.name()).isEqualTo("Nautilus");
    assertThat(found.createdAt()).isNotNull();
  }

  @Test
  void updatesNameAndDescriptionButKeepsIdAndCreatedAt() {
    BoatResponse created = service.create(new BoatRequest("Old", "Old description"));
    entityManager.flush();
    entityManager.clear();

    service.update(created.id(), new BoatRequest("New", null));
    entityManager.flush();
    entityManager.clear();

    BoatResponse updated = service.get(created.id());
    assertThat(updated.id()).isEqualTo(created.id());
    assertThat(updated.createdAt()).isEqualTo(created.createdAt());
    assertThat(updated.name()).isEqualTo("New");
    assertThat(updated.description()).isNull();
  }

  @Test
  void deletesBoat() {
    BoatResponse created = service.create(new BoatRequest("Doomed", null));
    entityManager.flush();

    service.delete(created.id());
    entityManager.flush();

    assertThat(repository.existsById(created.id())).isFalse();
  }

  @Test
  void missingBoatThrowsNotFound() {
    UUID missing = UUID.randomUUID();

    assertThatThrownBy(() -> service.get(missing)).isInstanceOf(BoatNotFoundException.class);
    assertThatThrownBy(() -> service.update(missing, new BoatRequest("x", null)))
        .isInstanceOf(BoatNotFoundException.class);
    assertThatThrownBy(() -> service.delete(missing)).isInstanceOf(BoatNotFoundException.class);
  }
}
