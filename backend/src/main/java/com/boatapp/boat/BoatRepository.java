package com.boatapp.boat;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BoatRepository extends JpaRepository<Boat, UUID> {

  /**
   * Case-insensitive substring match on name or description. {@code pattern} must already contain
   * the surrounding {@code %} and have LIKE wildcards in the user input escaped with {@code \}.
   */
  @Query(
      """
      select b from Boat b
      where lower(b.name) like lower(:pattern) escape '\\'
         or lower(b.description) like lower(:pattern) escape '\\'
      """)
  Page<Boat> search(String pattern, Pageable pageable);
}
