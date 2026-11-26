package vn.vku.nihongoai.progress;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDailyStatId implements Serializable {
    private Long user;
    private LocalDate statDate;
}
