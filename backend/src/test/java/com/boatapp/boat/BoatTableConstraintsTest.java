package com.boatapp.boat;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Bean Validation is switched off here so the database constraints themselves are exercised. Each
 * test ends at the failing flush: PostgreSQL aborts the transaction, so nothing may use it
 * afterwards (the test transaction is rolled back).
 */
@DataJpaTest(properties = "spring.jpa.properties.jakarta.persistence.validation.mode=none")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(PostgresTestContainer.class)
class BoatTableConstraintsTest {

  @Autowired BoatRepository repository;

  @Test
  void databaseRejectsBlankName() {
    assertThatThrownBy(() -> repository.saveAndFlush(new Boat("   ", null)))
        .isInstanceOf(DataIntegrityViolationException.class)
        .hasMessageContaining("boats_name_not_blank");
  }

  @Test
  void databaseRejectsNameLongerThan150Characters() {
    assertThatThrownBy(() -> repository.saveAndFlush(new Boat("x".repeat(151), null)))
        .isInstanceOf(DataIntegrityViolationException.class);
  }
}
