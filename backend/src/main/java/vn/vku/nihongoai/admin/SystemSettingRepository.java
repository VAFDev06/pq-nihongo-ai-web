package vn.vku.nihongoai.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SystemSettingRepository extends JpaRepository<SystemSetting, String> {
    default String getSettingValue(String key, String defaultValue) {
        return findById(key).map(SystemSetting::getValue).orElse(defaultValue);
    }
}
