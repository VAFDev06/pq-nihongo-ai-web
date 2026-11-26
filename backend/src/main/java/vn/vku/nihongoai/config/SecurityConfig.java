package vn.vku.nihongoai.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.common.GlobalExceptionHandler;
import vn.vku.nihongoai.security.CustomUserDetailsService;
import vn.vku.nihongoai.security.JwtAuthFilter;

import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CustomUserDetailsService userDetailsService;
    private final CorsConfigurationSource corsConfigurationSource;
    private final ObjectMapper objectMapper;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                            GlobalExceptionHandler.ErrorResponse err = GlobalExceptionHandler.ErrorResponse.builder()
                                    .status(401)
                                    .code(ErrorCode.AUTH_UNAUTHORIZED.name())
                                    .message("Yêu cầu đăng nhập để truy cập tài nguyên")
                                    .build();
                            response.getWriter().write(objectMapper.writeValueAsString(err));
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                            GlobalExceptionHandler.ErrorResponse err = GlobalExceptionHandler.ErrorResponse.builder()
                                    .status(403)
                                    .code(ErrorCode.FORBIDDEN.name())
                                    .message("Bạn không có quyền truy cập chức năng này (Phân quyền tách biệt ADMIN / USER)")
                                    .build();
                            response.getWriter().write(objectMapper.writeValueAsString(err));
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        // 1. Public endpoints
                        .requestMatchers(
                                "/api/v1/auth/**",
                                "/api/v1/templates/**",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/uploads/**",
                                "/actuator/health"
                        ).permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 2. Shared authenticated utilities (own profile & furigana tokenizer)
                        .requestMatchers("/api/v1/users/**", "/api/v1/furigana/**").hasAnyRole("USER", "ADMIN")

                        // 3. Strictly ADMIN-only endpoints
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")

                        // 4. Strictly USER-only learning endpoints (ADMIN is blocked with HTTP 403)
                        .requestMatchers(
                                "/api/v1/vocab/**",
                                "/api/v1/topics/**",
                                "/api/v1/recognitions/**",
                                "/api/v1/shadowing/**",
                                "/api/v1/conversation/**",
                                "/api/v1/conversations/**",
                                "/api/v1/decks/**",
                                "/api/v1/cards/**",
                                "/api/v1/srs/**",
                                "/api/v1/quiz/**",
                                "/api/v1/progress/**",
                                "/api/v1/dashboard/**"
                        ).hasRole("USER")

                        .anyRequest().hasRole("USER")
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }
}
