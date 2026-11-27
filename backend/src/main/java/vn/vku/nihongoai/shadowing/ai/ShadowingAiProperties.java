package vn.vku.nihongoai.shadowing.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "shadowing.ai")
@Data
public class ShadowingAiProperties {

    private boolean enabled = true;

    private String baseUrl = "http://localhost:8001";

    private int timeoutSeconds = 120;

    private int maxAudioMb = 15;
}
