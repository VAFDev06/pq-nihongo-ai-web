package vn.vku.nihongoai.storage;

import org.springframework.web.multipart.MultipartFile;

public interface StorageService {
    String storeFile(MultipartFile file, String subDir);
    byte[] loadFileAsBytes(String filePath);
    void deleteFile(String filePath);
}
