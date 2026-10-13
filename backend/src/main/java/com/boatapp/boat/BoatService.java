package com.boatapp.boat;

import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BoatService {

  private final BoatRepository repository;

  public BoatService(BoatRepository repository) {
    this.repository = repository;
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

  private Boat find(UUID id) {
    return repository.findById(id).orElseThrow(() -> new BoatNotFoundException(id));
  }
}
