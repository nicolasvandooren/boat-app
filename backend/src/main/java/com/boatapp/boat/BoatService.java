package com.boatapp.boat;

import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BoatService {

  /** Newest first; id breaks ties so paging is stable when timestamps are equal. */
  private static final Sort ORDER = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

  private final BoatRepository repository;

  public BoatService(BoatRepository repository) {
    this.repository = repository;
  }

  /**
   * {@code page} and {@code size} are validated by the controller. Blank search means no filter.
   */
  public BoatPageResponse list(int page, int size, String search) {
    PageRequest pageable = PageRequest.of(page, size, ORDER);
    if (search == null || search.isBlank()) {
      return BoatPageResponse.from(repository.findAll(pageable));
    }
    return BoatPageResponse.from(repository.search(likePattern(search.strip()), pageable));
  }

  public BoatResponse get(UUID id) {
    return BoatResponse.from(find(id));
  }

  @Transactional
  public BoatResponse create(BoatRequest request) {
    Boat boat = repository.save(new Boat(request.name(), request.description()));
    return BoatResponse.from(boat);
  }

  /** Last write wins: no version check. */
  @Transactional
  public BoatResponse update(UUID id, BoatRequest request) {
    Boat boat = find(id);
    boat.setName(request.name());
    boat.setDescription(request.description());
    return BoatResponse.from(boat);
  }

  @Transactional
  public void delete(UUID id) {
    repository.delete(find(id));
  }

  /** Treats the user's input literally: LIKE wildcards and the escape character are escaped. */
  private static String likePattern(String search) {
    String escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    return "%" + escaped + "%";
  }

  private Boat find(UUID id) {
    return repository.findById(id).orElseThrow(() -> new BoatNotFoundException(id));
  }
}
