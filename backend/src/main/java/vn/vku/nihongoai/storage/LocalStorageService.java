package vn.vku.nihongoai.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
@Slf4j
public class LocalStorageService implements StorageService {

    private final Path rootDir;

    public LocalStorageService(@Value("${app.upload.dir:./uploads}") String uploadDir) {
        this.rootDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootDir);
        } catch (IOException e) {
            log.error("Could not initialize upload folder: {}", uploadDir, e);
        }
    }

    @Override
    public String storeFile(MultipartFile file, String subDir) {
        if (file.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Tệp tải lên rỗng");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = ".jpg";
        if (originalFilename != null && originalFilename.contains(".")) {
            String ext = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
            if (ext.equals(".jpg") || ext.equals(".jpeg") || ext.equals(".png") || ext.equals(".webp")) {
                extension = ext;
            }
        }
        String ct = file.getContentType();
        if (ct != null) {
            if (ct.equalsIgnoreCase("image/png")) extension = ".png";
            else if (ct.equalsIgnoreCase("image/webp")) extension = ".webp";
            else if (ct.equalsIgnoreCase("image/jpeg") || ct.equalsIgnoreCase("image/jpg")) extension = ".jpg";
        }

        String filename = subDir + "_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8) + extension;
        Path targetDir = this.rootDir.resolve(subDir).normalize();

        try {
            Files.createDirectories(targetDir);
            Path targetFile = targetDir.resolve(filename);

            if (!targetFile.startsWith(this.rootDir)) {
                throw new AppException(ErrorCode.VALIDATION_ERROR, "Đường dẫn tệp không hợp lệ");
            }

            Files.copy(file.getInputStream(), targetFile, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/" + subDir + "/" + filename;
        } catch (IOException e) {
            log.error("Failed to store file", e);
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Không thể lưu tệp lên hệ thống");
        }
    }

    @Override
    public byte[] loadFileAsBytes(String filePath) {
        try {
            String cleanPath = filePath.startsWith("/uploads/") ? filePath.substring(9) : filePath;
            Path file = this.rootDir.resolve(cleanPath).normalize();
            if (!Files.exists(file) || !file.startsWith(this.rootDir)) {
                throw new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy tệp yêu cầu");
            }
            return Files.readAllBytes(file);
        } catch (IOException e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Lỗi đọc tệp");
        }
    }

    @Override
    public void deleteFile(String filePath) {
        try {
            String cleanPath = filePath.startsWith("/uploads/") ? filePath.substring(9) : filePath;
            Path file = this.rootDir.resolve(cleanPath).normalize();
            if (Files.exists(file) && file.startsWith(this.rootDir)) {
                Files.delete(file);
            }
        } catch (IOException e) {
            log.warn("Failed to delete file: {}", filePath, e);
        }
    }
}
