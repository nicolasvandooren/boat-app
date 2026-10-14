package com.boatapp.boat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
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

  // --- listing and search -------------------------------------------------------------------

  private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");

  /** Inserts with explicit id and created_at so ordering assertions are deterministic. */
  private void insert(UUID id, String name, String description, Instant createdAt) {
    entityManager
        .getEntityManager()
        .createNativeQuery(
            "insert into boats (id, name, description, created_at) values (?1, ?2, ?3, ?4)")
        .setParameter(1, id)
        .setParameter(2, name)
        .setParameter(3, description)
        .setParameter(4, createdAt)
        .executeUpdate();
  }

  private static UUID uuid(int n) {
    return UUID.fromString(String.format("00000000-0000-0000-0000-%012d", n));
  }

  /** Boat i is created i minutes after T0, so boat n-1 is the newest. */
  private void insertBoats(int count, String namePrefix) {
    for (int i = 0; i < count; i++) {
      insert(uuid(i + 1), namePrefix + " " + i, null, T0.plusSeconds(60L * i));
    }
  }

  private static List<String> names(BoatPageResponse page) {
    return page.content().stream().map(BoatResponse::name).toList();
  }

  @Test
  void listReturnsNewestFirstWithMetadata() {
    insertBoats(3, "Boat");

    BoatPageResponse page = service.list(0, 10, null);

    assertThat(names(page)).containsExactly("Boat 2", "Boat 1", "Boat 0");
    assertThat(page.page()).isZero();
    assertThat(page.size()).isEqualTo(10);
    assertThat(page.totalElements()).isEqualTo(3);
    assertThat(page.totalPages()).isEqualTo(1);
  }

  @Test
  void listSplitsIntoPagesWithCorrectMetadata() {
    insertBoats(25, "Boat");

    BoatPageResponse first = service.list(0, 10, null);
    BoatPageResponse second = service.list(1, 10, null);
    BoatPageResponse last = service.list(2, 10, null);
    BoatPageResponse beyond = service.list(3, 10, null);

    assertThat(first.content()).hasSize(10);
    assertThat(names(first).getFirst()).isEqualTo("Boat 24");
    assertThat(names(second)).first().isEqualTo("Boat 14");
    assertThat(names(last)).containsExactly("Boat 4", "Boat 3", "Boat 2", "Boat 1", "Boat 0");
    assertThat(beyond.content()).isEmpty();
    for (BoatPageResponse page : List.of(first, second, last, beyond)) {
      assertThat(page.totalElements()).isEqualTo(25);
      assertThat(page.totalPages()).isEqualTo(3);
      assertThat(page.size()).isEqualTo(10);
    }
    assertThat(beyond.page()).isEqualTo(3);
  }

  @Test
  void listBreaksCreatedAtTiesByIdDescending() {
    // Small sequential UUIDs order the same way in PostgreSQL and Java.
    insert(uuid(1), "First id", null, T0);
    insert(uuid(3), "Third id", null, T0);
    insert(uuid(2), "Second id", null, T0);
    insert(uuid(4), "Older", null, T0.minusSeconds(1));

    assertThat(names(service.list(0, 10, null)))
        .containsExactly("Third id", "Second id", "First id", "Older");
    assertThat(names(service.list(0, 2, null))).containsExactly("Third id", "Second id");
    assertThat(names(service.list(1, 2, null))).containsExactly("First id", "Older");
  }

  @Test
  void listWithoutBoatsReturnsEmptyPage() {
    BoatPageResponse page = service.list(0, 10, null);

    assertThat(page.content()).isEmpty();
    assertThat(page.totalElements()).isZero();
    assertThat(page.totalPages()).isZero();
  }

  @Test
  void searchIsCaseInsensitiveOnNameAndDescription() {
    insert(uuid(1), "Black Pearl", null, T0);
    insert(uuid(2), "Nautilus", "A SUBMARINE of Captain Nemo", T0.plusSeconds(1));
    insert(uuid(3), "Rowboat", "Small and wooden", T0.plusSeconds(2));

    assertThat(names(service.list(0, 10, "pEaRl"))).containsExactly("Black Pearl");
    assertThat(names(service.list(0, 10, "submarine"))).containsExactly("Nautilus");
    assertThat(names(service.list(0, 10, "  BOAT  "))).containsExactly("Rowboat");
    assertThat(service.list(0, 10, "no such boat").content()).isEmpty();
  }

  @Test
  void blankSearchMeansNoFilter() {
    insertBoats(3, "Boat");

    assertThat(service.list(0, 10, "").totalElements()).isEqualTo(3);
    assertThat(service.list(0, 10, "   ").totalElements()).isEqualTo(3);
  }

  @Test
  void searchIsAppliedBeforePagination() {
    insertBoats(15, "Sloop");
    for (int i = 0; i < 5; i++) {
      insert(uuid(100 + i), "Ketch " + i, null, T0.plusSeconds(10_000L + i));
    }

    BoatPageResponse first = service.list(0, 10, "sloop");
    BoatPageResponse second = service.list(1, 10, "sloop");

    assertThat(first.totalElements()).isEqualTo(15);
    assertThat(first.totalPages()).isEqualTo(2);
    assertThat(first.content()).hasSize(10).allMatch(b -> b.name().startsWith("Sloop"));
    assertThat(names(first).getFirst()).isEqualTo("Sloop 14");
    assertThat(names(second)).hasSize(5).last().isEqualTo("Sloop 0");
  }

  @Test
  void searchTreatsLikeWildcardsLiterally() {
    insert(uuid(1), "100% teak", null, T0);
    insert(uuid(2), "1000 tons", null, T0.plusSeconds(1));
    insert(uuid(3), "Sea_Wolf", null, T0.plusSeconds(2));
    insert(uuid(4), "Sea Wolf", null, T0.plusSeconds(3));

    assertThat(names(service.list(0, 10, "100%"))).containsExactly("100% teak");
    assertThat(names(service.list(0, 10, "sea_"))).containsExactly("Sea_Wolf");
    assertThat(service.list(0, 10, "%").content())
        .extracting(BoatResponse::name)
        .containsExactly("100% teak");
  }
}
