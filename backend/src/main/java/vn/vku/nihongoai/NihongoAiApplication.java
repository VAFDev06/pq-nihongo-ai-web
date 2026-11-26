package vn.vku.nihongoai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@SpringBootApplication
@EnableAsync
public class NihongoAiApplication {
    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(NihongoAiApplication.class, args);
    }

    private static void loadDotEnv() {
        for (String candidate : List.of(".env", "../.env", "d:/DACS4/.env")) {
            try {
                Path path = Path.of(candidate);
                if (Files.exists(path)) {
                    for (String rawLine : Files.readAllLines(path)) {
                        String line = rawLine.trim();
                        if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) {
                            continue;
                        }
                        int idx = line.indexOf('=');
                        String key = line.substring(0, idx).trim();
                        String val = line.substring(idx + 1).trim();
                        if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.substring(1, val.length() - 1);
                        }
                        if (System.getenv(key) == null && System.getProperty(key) == null && !val.isEmpty()) {
                            System.setProperty(key, val);
                        }
                    }
                    break;
                }
            } catch (Exception ignored) {
            }
        }
    }
}

