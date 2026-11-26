package vn.vku.nihongoai.ai;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface AiCallLogRepository extends JpaRepository<AiCallLog, Long> {

    @Query("SELECT COUNT(l) FROM AiCallLog l WHERE l.user.id = :userId AND l.createdAt >= :startOfDay")
    long countTodayCallsByUser(@Param("userId") Long userId, @Param("startOfDay") Instant startOfDay);

    @Query("SELECT l FROM AiCallLog l WHERE " +
           "(:feature IS NULL OR l.feature = :feature) AND " +
           "(:status IS NULL OR l.status = :status) AND " +
           "l.createdAt >= :fromTime AND " +
           "l.createdAt <= :toTime")
    Page<AiCallLog> searchLogs(
            @Param("feature") AiFeature feature,
            @Param("status") AiCallStatus status,
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime,
            Pageable pageable
    );

    @Query("SELECT COUNT(l) FROM AiCallLog l WHERE l.createdAt >= :startOfDay")
    long countCallsSince(@Param("startOfDay") Instant startOfDay);

    @Query("SELECT COALESCE(SUM(COALESCE(l.promptTokens, 0) + COALESCE(l.completionTokens, 0)), 0) FROM AiCallLog l WHERE l.createdAt >= :startOfDay")
    long sumTokensSince(@Param("startOfDay") Instant startOfDay);

    @Query("SELECT AVG(l.latencyMs) FROM AiCallLog l WHERE l.status = 'SUCCESS'")
    Double getAverageLatency();
}
