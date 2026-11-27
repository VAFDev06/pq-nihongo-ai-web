package vn.vku.nihongoai.shadowing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Safe public status summary for the private Shadowing AI Model Server.
 * Never exposes internal base URLs, credentials, or host details to the browser.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShadowingAiStatusDto {
    private boolean enabled;
    private boolean available;
    private String status; // UP | DEGRADED | DISABLED | UNAVAILABLE
    private String device;
    private boolean geminiUsed;
    private Map<String, Object> components;
    private String message;
}
