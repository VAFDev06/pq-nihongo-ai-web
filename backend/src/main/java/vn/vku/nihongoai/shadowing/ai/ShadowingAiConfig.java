package vn.vku.nihongoai.shadowing.ai;

import io.netty.channel.ChannelOption;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

/**
 * Dedicated internal HTTP WebClient for the Private Shadowing AI Model Server.
 * Completely independent from GeminiClient and WebClientConfig.geminiWebClient().
 */
@Configuration
public class ShadowingAiConfig {

    @Bean(name = "shadowingAiWebClient")
    public WebClient shadowingAiWebClient(ShadowingAiProperties properties) {
        int timeoutSec = Math.max(10, properties.getTimeoutSeconds());
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
                .responseTimeout(Duration.ofSeconds(timeoutSec));

        return WebClient.builder()
                .baseUrl(properties.getBaseUrl())
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(24 * 1024 * 1024))
                .build();
    }
}
