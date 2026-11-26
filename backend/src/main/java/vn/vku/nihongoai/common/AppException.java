package vn.vku.nihongoai.common;

import lombok.Getter;

@Getter
public class AppException extends RuntimeException {
    private final ErrorCode errorCode;
    private final Object details;

    public AppException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
        this.details = null;
    }

    public AppException(ErrorCode errorCode, String customMessage) {
        super(customMessage);
        this.errorCode = errorCode;
        this.details = null;
    }

    public AppException(ErrorCode errorCode, String customMessage, Object details) {
        super(customMessage);
        this.errorCode = errorCode;
        this.details = details;
    }
}

