package vn.vku.nihongoai.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ErrorResponse {
        @Builder.Default
        private boolean success = false;
        @Builder.Default
        private Instant timestamp = Instant.now();
        private int status;
        private String code;
        private String message;
        private Object details;
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResponse> handleAppException(AppException ex) {
        ErrorCode ec = ex.getErrorCode();
        ErrorResponse res = ErrorResponse.builder()
                .status(ec.getStatus().value())
                .code(ec.name())
                .message(ex.getMessage())
                .details(ex.getDetails())
                .build();
        return new ResponseEntity<>(res, ec.getStatus());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            errors.put(fe.getField(), fe.getDefaultMessage());
        }
        ErrorResponse res = ErrorResponse.builder()
                .status(HttpStatus.BAD_REQUEST.value())
                .code(ErrorCode.VALIDATION_ERROR.name())
                .message("Dữ liệu đầu vào không hợp lệ")
                .details(errors)
                .build();
        return new ResponseEntity<>(res, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex) {
        ErrorResponse res = ErrorResponse.builder()
                .status(HttpStatus.UNAUTHORIZED.value())
                .code(ErrorCode.AUTH_INVALID_CREDENTIALS.name())
                .message(ErrorCode.AUTH_INVALID_CREDENTIALS.getDefaultMessage())
                .build();
        return new ResponseEntity<>(res, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(LockedException.class)
    public ResponseEntity<ErrorResponse> handleLocked(LockedException ex) {
        ErrorResponse res = ErrorResponse.builder()
                .status(HttpStatus.FORBIDDEN.value())
                .code(ErrorCode.AUTH_ACCOUNT_LOCKED.name())
                .message(ErrorCode.AUTH_ACCOUNT_LOCKED.getDefaultMessage())
                .build();
        return new ResponseEntity<>(res, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        ErrorResponse res = ErrorResponse.builder()
                .status(HttpStatus.FORBIDDEN.value())
                .code(ErrorCode.FORBIDDEN.name())
                .message(ErrorCode.FORBIDDEN.getDefaultMessage())
                .build();
        return new ResponseEntity<>(res, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUpload(MaxUploadSizeExceededException ex) {
        ErrorResponse res = ErrorResponse.builder()
                .status(HttpStatus.PAYLOAD_TOO_LARGE.value())
                .code(ErrorCode.FILE_TOO_LARGE.name())
                .message("Kích thước tệp tải lên vượt quá giới hạn tối đa")
                .build();
        return new ResponseEntity<>(res, HttpStatus.PAYLOAD_TOO_LARGE);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        log.error("Unhandled exception: ", ex);
        ErrorResponse res = ErrorResponse.builder()
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .code(ErrorCode.INTERNAL_SERVER_ERROR.name())
                .message(ErrorCode.INTERNAL_SERVER_ERROR.getDefaultMessage())
                .build();
        return new ResponseEntity<>(res, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}

