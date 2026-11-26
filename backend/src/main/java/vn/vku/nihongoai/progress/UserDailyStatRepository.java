package vn.vku.nihongoai.progress;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserDailyStatRepository extends JpaRepository<UserDailyStat, UserDailyStatId> {
    Optional<UserDailyStat> findByUserIdAndStatDate(Long userId, LocalDate statDate);

    @Query("SELECT s FROM UserDailyStat s WHERE s.user.id = :userId AND s.statDate >= :startDate ORDER BY s.statDate ASC")
    List<UserDailyStat> findStatsFromDate(@Param("userId") Long userId, @Param("startDate") LocalDate startDate);
}
