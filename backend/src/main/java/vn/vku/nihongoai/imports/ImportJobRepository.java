package vn.vku.nihongoai.imports;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ImportJobRepository extends JpaRepository<ImportJob, Long> {
    Optional<ImportJob> findByIdAndUserId(Long id, Long userId);
}
