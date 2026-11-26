package vn.vku.nihongoai.common;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    AUTH_INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu không chính xác"),
    AUTH_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn, vui lòng làm mới token"),
    AUTH_UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Yêu cầu đăng nhập để truy cập tài nguyên"),
    AUTH_ACCOUNT_LOCKED(HttpStatus.FORBIDDEN, "Tài khoản của bạn đã bị khóa bởi quản trị viên"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Không tìm thấy tài nguyên yêu cầu"),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Dữ liệu đầu vào không hợp lệ"),
    DUPLICATE_RESOURCE(HttpStatus.CONFLICT, "Dữ liệu đã tồn tại trong hệ thống"),
    FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "Dung lượng tệp vượt quá giới hạn cho phép"),
    UNSUPPORTED_FILE_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Định dạng tệp không được hỗ trợ"),
    AI_QUOTA_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "Bạn đã sử dụng hết lượt gọi AI trong ngày"),
    AI_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Dịch vụ AI hiện không khả dụng, vui lòng thử lại sau"),
    AI_BAD_RESPONSE(HttpStatus.BAD_GATEWAY, "Phản hồi từ AI không hợp lệ hoặc không đúng định dạng"),
    IMPORT_INVALID_FILE(HttpStatus.BAD_REQUEST, "Tệp import không hợp lệ hoặc chứa lỗi cấu trúc"),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }
}

