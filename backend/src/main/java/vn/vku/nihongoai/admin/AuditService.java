package vn.vku.nihongoai.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void log(Long adminId, String action, String entityType, Long entityId, Object detail) {
        try {
            User admin = adminId != null ? userRepository.findById(adminId).orElse(null) : null;
            String detailJson = detail != null ? objectMapper.writeValueAsString(detail) : null;

            AuditLog logEntry = AuditLog.builder()
                    .admin(admin)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .detail(detailJson)
                    .build();

            auditLogRepository.save(logEntry);
        } catch (Exception e) {
            log.warn("Failed to write audit log: {}", e.getMessage());
        }
    }
}
