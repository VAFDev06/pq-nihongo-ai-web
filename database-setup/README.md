# Hướng dẫn Cài đặt, Migration, Sao lưu & Di chuyển PostgreSQL — PQ Nihongo

> **Tài liệu độc lập**: Hướng dẫn đầy đủ từ con số 0 để thiết lập cơ sở dữ liệu PostgreSQL trên một máy tính hoàn toàn mới, kết nối với Backend PQ Nihongo, chạy Flyway migration, sao lưu và chuyển dữ liệu sang máy khác.
>
> - Xem tổng quan dự án & hướng dẫn chạy ứng dụng tại [`../README.md`](../README.md).
> - Xem giáo trình giải thích chuyên sâu database và source code tại [`../docs/LEARNING_GUIDE.md`](../docs/LEARNING_GUIDE.md).

---

## Mục lục

1. [Tổng quan Database của dự án](#1-tổng-quan-database-của-dự-án)
2. [Yêu cầu môi trường](#2-yêu-cầu-môi-trường)
3. [Cài đặt PostgreSQL trên Windows](#3-cài-đặt-postgresql-trên-windows)
4. [Cài đặt PostgreSQL trên Ubuntu](#4-cài-đặt-postgresql-trên-ubuntu)
5. [Tạo Database](#5-tạo-database)
6. [Tạo User và phân quyền](#6-tạo-user-và-phân-quyền)
7. [Cấu hình kết nối trong dự án](#7-cấu-hình-kết-nối-trong-dự-án)
8. [Chạy Migration theo đúng cơ chế dự án (Flyway)](#8-chạy-migration-theo-đúng-cơ-chế-dự-án-flyway)
9. [Kiểm tra các bảng sau khi Migration](#9-kiểm-tra-các-bảng-sau-khi-migration)
10. [Dữ liệu ban đầu (Seed Data)](#10-dữ-liệu-ban-đầu-seed-data)
11. [Tạo tài khoản ADMIN theo cơ chế thực tế](#11-tạo-tài-khoản-admin-theo-cơ-chế-thực-tế)
12. [Kiểm tra kết nối Backend](#12-kiểm-tra-kết-nối-backend)
13. [Backup Database](#13-backup-database)
14. [Restore Database](#14-restore-database)
15. [Chuyển Database sang máy khác](#15-chuyển-database-sang-máy-khác)
16. [Kết nối Database từ máy khác (Mạng LAN / Server)](#16-kết-nối-database-từ-máy-khác-mạng-lan--server)
17. [Các lỗi thường gặp và cách xử lý](#17-các-lỗi-thường-gặp-và-cách-xử-lý)

---

## 1. Tổng quan Database của dự án

Các thông số dưới đây được đối chiếu trực tiếp từ `backend/src/main/resources/application.yml`, `application-dev.yml`, `docker-compose.yml` và thư mục `backend/src/main/resources/db/migration/`:

| Thông số | Giá trị thực tế trong mã nguồn | Ghi chú |
| :--- | :--- | :--- |
| **Hệ quản trị CSDL** | **PostgreSQL 16** (tương thích 15/16) | `docker-compose.yml` dùng image `postgres:16-alpine`. |
| **Tên Database mặc định** | `nihongoai` | Định nghĩa trong `SPRING_DATASOURCE_URL`. |
| **Cổng mặc định** | `5432` | Cổng TCP tiêu chuẩn của PostgreSQL. |
| **Schema** | `public` | Toàn bộ bảng nghiệp vụ và `flyway_schema_history` nằm ở `public`. |
| **Chuỗi JDBC URL** | `jdbc:postgresql://localhost:5432/nihongoai` | Đọc từ biến môi trường `SPRING_DATASOURCE_URL`. |
| **Driver JDBC** | `org.postgresql.Driver` | Khai báo trong `backend/pom.xml`. |
| **Cơ chế tạo & cập nhật bảng** | **Flyway Migration** (`V1` → `V9`) | Tự động chạy khi Spring Boot khởi động ở profile `dev`. |
| **Chế độ Hibernate DDL** | `validate` | Hibernate **không tự tạo/sửa bảng**, chỉ đối chiếu Entity với DB. |
| **Tổng số bảng** | **27 bảng nghiệp vụ** + `flyway_schema_history` | Tổng **28 bảng** trong schema `public`. |

> **Phân biệt rõ 6 khái niệm quan trọng** để tránh nhầm lẫn khi thao tác:
> 1. **Cài đặt PostgreSQL**: Cài phần mềm máy chủ CSDL (service chạy nền cổng `5432`) và bộ công cụ dòng lệnh (`psql`, `pg_dump`, `pg_restore`).
> 2. **Tạo database**: Tạo kho dữ liệu trống tên `nihongoai` bên trong máy chủ PostgreSQL.
> 3. **Khởi tạo schema**: Tạo các bảng, khóa chính, khóa ngoại, ràng buộc và chỉ mục (do file `V1__init_schema.sql` đảm nhiệm).
> 4. **Chạy migration**: Flyway tự động áp dụng tuần tự các bản nâng cấp cấu trúc từ `V1` đến `V9` và ghi lịch sử vào `flyway_schema_history`.
> 5. **Nạp dữ liệu ban đầu (Seed)**: Nạp cấu hình mặc định, chủ đề, từ vựng mẫu, bộ thẻ mẫu, bài Shadowing, chủ đề hội thoại (tích hợp trong `V2`, `V3`, `V4`, `V5`, `V8` và `DataInitializer.java`).
> 6. **Backup & Restore**: Đóng gói toàn bộ cấu trúc + dữ liệu thực tế ra file (`.dump` / `.sql`) và nạp lại khi cần khôi phục hoặc chuyển máy.

---

## 2. Yêu cầu môi trường

- **Hệ điều hành**: Windows 10/11 (64-bit) hoặc Ubuntu 20.04 / 22.04 / 24.04 LTS.
- **Dung lượng đĩa trống**: Tối thiểu 1 GB cho cài đặt PostgreSQL và dữ liệu học tập (tăng thêm nếu lưu nhiều file backup).
- **Quyền hệ thống**: Quyền Administrator (trên Windows) hoặc quyền `sudo` (trên Ubuntu).
- **Cổng mạng**: Cổng `5432` không bị phần mềm khác chiếm dụng.

---

## 3. Cài đặt PostgreSQL trên Windows

### Bước 3.1: Tải và cài đặt PostgreSQL 16
1. Truy cập `https://www.postgresql.org/download/windows/` → chọn **Download the installer** (EnterpriseDB) → tải bản **PostgreSQL 16.x (Windows x86-64)**.
2. Chạy file `.exe` vừa tải và thực hiện theo trình cài đặt:
   - **Installation Directory**: Giữ mặc định `C:\Program Files\PostgreSQL\16`.
   - **Select Components**: Tích chọn đầy đủ:
     - `PostgreSQL Server`
     - `pgAdmin 4` (giao diện đồ họa trực quan)
     - `Command Line Tools` (cung cấp `psql`, `pg_dump`, `pg_restore`)
   - **Data Directory**: Giữ mặc định `C:\Program Files\PostgreSQL\16\data`.
   - **Password**: Nhập mật khẩu mạnh cho siêu quản trị `postgres` và lưu lại an toàn.
   - **Port**: Giữ mặc định `5432`.
   - **Locale**: Giữ `Default locale`.
3. Hoàn tất cài đặt (bỏ tích *Stack Builder* ở màn hình cuối vì không cần thiết).

### Bước 3.2: Thêm `psql`, `pg_dump`, `pg_restore` vào biến môi trường `PATH`
1. Nhấn phím **Windows** → gõ `Environment Variables` → chọn **Edit the system environment variables**.
2. Bấm **Environment Variables...** → trong khung **System variables**, chọn dòng `Path` → bấm **Edit**.
3. Bấm **New** và thêm đúng đường dẫn thư mục `bin`:
   ```text
   C:\Program Files\PostgreSQL\16\bin
   ```
4. Bấm **OK** để lưu tất cả cửa sổ, sau đó **mở cửa sổ PowerShell mới**.

### Bước 3.3: Xác minh cài đặt và dịch vụ PostgreSQL
```powershell
psql --version
Get-Service *postgres*
```
Kết quả đạt yêu cầu:
- `psql (PostgreSQL) 16.x`
- Dịch vụ `postgresql-x64-16` có trạng thái `Running`.

Nếu dịch vụ đang `Stopped`, khởi động bằng PowerShell (Run as Administrator):
```powershell
Start-Service postgresql-x64-16
```

---

## 4. Cài đặt PostgreSQL trên Ubuntu

### Bước 4.1: Cài đặt PostgreSQL 16 chính thức
Trên Ubuntu 24.04, PostgreSQL 16 có sẵn trong kho mặc định. Để đảm bảo cài đúng phiên bản 16 trên mọi bản Ubuntu (20.04 / 22.04 / 24.04), thêm kho chính thức PGDG:

```bash
sudo apt update
sudo apt install -y curl ca-certificates gnupg lsb-release

# Thêm khóa ký và kho lưu trữ chính thức của PostgreSQL
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc

echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16
```

### Bước 4.2: Khởi động dịch vụ và đặt mật khẩu cho user `postgres`
```bash
sudo systemctl enable --now postgresql
sudo systemctl status postgresql --no-pager
psql --version
```
Đặt mật khẩu cho tài khoản `postgres` (thay `<mat_khau_manh>` bằng mật khẩu của bạn):
```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '<mat_khau_manh>';"
```

---

## 5. Tạo Database

> Bước này chỉ tạo một **database rỗng** tên `nihongoai` chuẩn mã hóa UTF-8 (hỗ trợ đầy đủ tiếng Nhật Kanji/Hiragana/Katakana và tiếng Việt). Không cần chạy SQL tạo bảng bằng tay vì Flyway sẽ làm ở Mục 8.

### Trên Windows (PowerShell)
```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE nihongoai WITH ENCODING 'UTF8';"
```
*(Nhập mật khẩu user `postgres` khi được hỏi.)*

### Trên Ubuntu
```bash
sudo -u postgres psql -c "CREATE DATABASE nihongoai WITH ENCODING 'UTF8';"
```

### Xác minh database vừa tạo
```bash
# Windows: psql -U postgres -h localhost -p 5432 -l
# Ubuntu:  sudo -u postgres psql -l
```
Đảm bảo thấy dòng `nihongoai` với Encoding `UTF8`.

---

## 6. Tạo User và phân quyền

Bạn có hai lựa chọn:
- **Môi trường phát triển cá nhân (Local Dev)**: Có thể dùng trực tiếp user `postgres` với mật khẩu bạn đã đặt.
- **Môi trường triển khai thực tế / máy mới (Khuyến nghị bảo mật)**: Tạo riêng một user ứng dụng (ví dụ `pq_nihongo_user`) chỉ có quyền trên database `nihongoai`.

### Tạo user ứng dụng và cấp quyền chuẩn PostgreSQL 15/16

> **Lưu ý quan trọng trên PostgreSQL 15/16**: Kể từ PostgreSQL 15, quyền `CREATE` trên schema `public` không còn được cấp mặc định cho user thường. Vì vậy **bắt buộc** phải cấp `GRANT ALL ON SCHEMA public` để Flyway có thể tạo bảng.

**Trên Windows:**
```powershell
psql -U postgres -h localhost -p 5432 -d nihongoai
```
**Trên Ubuntu:**
```bash
sudo -u postgres psql -d nihongoai
```

Sau khi vào dấu nhắc `nihongoai=#`, chạy các lệnh SQL sau (thay `<mat_khau_user>` bằng mật khẩu mạnh của bạn):

```sql
-- 1. Tạo user ứng dụng
CREATE USER pq_nihongo_user WITH PASSWORD '<mat_khau_user>';

-- 2. Chuyển quyền sở hữu database nihongoai cho user ứng dụng
ALTER DATABASE nihongoai OWNER TO pq_nihongo_user;

-- 3. Cấp toàn quyền trên database và schema public (bắt buộc cho Flyway trên PG 15/16)
GRANT ALL PRIVILEGES ON DATABASE nihongoai TO pq_nihongo_user;
GRANT ALL ON SCHEMA public TO pq_nihongo_user;
ALTER SCHEMA public OWNER TO pq_nihongo_user;

-- 4. Quyền mặc định cho mọi bảng và sequence tạo mới trong tương lai
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pq_nihongo_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pq_nihongo_user;

-- Thoát psql
\q
```

Kiểm tra đăng nhập bằng user mới:
```bash
psql -U pq_nihongo_user -h localhost -p 5432 -d nihongoai -c "SELECT current_user, current_database();"
```

---

## 7. Cấu hình kết nối trong dự án

Backend đọc cấu hình kết nối PostgreSQL từ `backend/src/main/resources/application.yml` (và `application-dev.yml`), với cơ chế tự động nạp file `.env` tại thư mục gốc dự án:

```yaml
spring:
  config:
    import: optional:file:.env[.properties],optional:file:../.env[.properties]
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/nihongoai}
    username: ${SPRING_DATASOURCE_USERNAME:postgres}
    password: ${SPRING_DATASOURCE_PASSWORD:123456}
    driver-class-name: org.postgresql.Driver
```

### Cấu hình file `.env` ở thư mục gốc (`PQ-Nihongo/.env`)
Sao chép `.env.example` thành `.env` và chỉnh 3 biến kết nối database (cùng các biến bảo mật khác):

```env
SPRING_PROFILES_ACTIVE=dev
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/nihongoai
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<mat_khau_postgresql_cua_ban>
```

Nếu bạn tạo user riêng ở Mục 6, sửa `SPRING_DATASOURCE_USERNAME=pq_nihongo_user` và điền mật khẩu tương ứng.

> **Không sử dụng sai tên biến**: Dự án dùng chuẩn Spring Boot (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`), **không** dùng `DB_HOST`, `DB_PORT`, hay `DB_NAME`.

---

## 8. Chạy Migration theo đúng cơ chế dự án (Flyway)

Dự án **không chạy file SQL thủ công** mà sử dụng **Flyway** tích hợp sẵn trong Spring Boot (`spring.flyway.enabled=true`, `locations=classpath:db/migration`, `baseline-on-migrate=true`).

### Danh sách 9 file Migration thực tế (`backend/src/main/resources/db/migration/`)

| Phiên bản | Tên file | Nội dung thực hiện |
| :--- | :--- | :--- |
| `V1` | `V1__init_schema.sql` | Tạo 24 bảng cốt lõi đầu tiên (tài khoản, từ vựng, nhận diện ảnh, flashcard, SRS, quiz, import, shadowing, hội thoại, tiến độ, admin) kèm khóa ngoại và index. |
| `V2` | `V2__seed_data.sql` | Nạp 8 cấu hình `system_settings`, 8 chủ đề `topics`, 5 chủ đề hội thoại AI, 5 bài Shadowing mẫu. |
| `V3` | `V3__seed_system_vocabularies.sql` | Nạp 100+ từ vựng hệ thống chuẩn JLPT N5–N3 vào bảng `vocabularies`. |
| `V4` | `V4__fix_schema_and_seed_decks.sql` | Chuẩn hóa kiểu cột khớp Hibernate `validate`, nâng model Gemini lên `gemini-3-flash-preview`, nạp 3 bộ thẻ mẫu hệ thống (N5/N4/N3) cùng các thẻ Flashcard. |
| `V5` | `V5__upgrade_features.sql` | Thêm cột `users.tts_speed` (mặc định `1.15`), bổ sung `han_viet`, `part_of_speech`, `example_reading`, mở rộng `conversation_topics` cho chủ đề cá nhân. |
| `V6` | `V6__srs_and_tutor_upgrade.sql` | Thêm `card_progress.review_count`, `review_logs.prev_due_at`/`next_due_at`, đồng bộ thẻ vào `card_progress`, thêm `tutor_mode`/`chat_mode`/`suggested_replies_json`. |
| `V7` | `V7__youtube_translation_and_deck_status.sql` | Tạo 2 bảng cache YouTube (`youtube_video_transcripts`, `youtube_video_sentences`) và thêm cột `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`) cho `flashcard_decks`. |
| `V8` | `V8__final_srs6_and_dialogue_shadowing.sql` | Nâng cấp `card_progress` & `review_logs` lên **SRS 6 cấp độ (Level 0–5)**, thêm `status`/`jlpt_level` cho `topics`, tạo bảng `shadowing_dialogue_lines` và nạp 2 bài hội thoại Shadowing A/B + 2 chủ đề hội thoại N2/N1. |
| `V9` | `V9__align_srs_level_int_type.sql` | Đồng bộ kiểu cột `srs_level`, `previous_level`, `new_level` sang `INT` (`INT4`) khớp với `Integer` của JPA. |

### Cách kích hoạt Migration
Chỉ cần khởi động Backend với profile `dev` (mặc định):

**Trên Windows (PowerShell):**
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```
**Trên Ubuntu (đã cài Maven `mvn`):**
```bash
cd backend
mvn spring-boot:run
```

Flyway sẽ tự động phát hiện database `nihongoai` đang trống, tạo bảng `flyway_schema_history` và chạy tuần tự từ `V1` đến `V9`. Sau đó Hibernate thực hiện kiểm chứng `ddl-auto: validate`.

> **Quy tắc tuyệt đối với Flyway**:
> - **KHÔNG bao giờ** chỉnh sửa hay xóa các file `V1`–`V9` đã chạy trên database hiện có (sẽ gây lỗi lệch checksum).
> - Khi cần thêm bảng/cột trong tương lai, luôn tạo file mới với số phiên bản tiếp theo: `V10__mo_ta_ngan.sql`.

---

## 9. Kiểm tra các bảng sau khi Migration

Chạy lệnh sau để xác nhận đủ **28 bảng** (27 bảng nghiệp vụ + `flyway_schema_history`) và phiên bản Flyway đã ở mức `9`:

```bash
# Windows (PowerShell):
psql -U postgres -h localhost -p 5432 -d nihongoai -c "\dt"
psql -U postgres -h localhost -p 5432 -d nihongoai -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"
```

```bash
# Ubuntu:
sudo -u postgres psql -d nihongoai -c "\dt"
sudo -u postgres psql -d nihongoai -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"
```

Kết quả mong đợi:
- `\dt` liệt kê đủ 28 bảng: `ai_call_logs`, `audit_logs`, `card_progress`, `conversation_corrections`, `conversation_messages`, `conversation_topics`, `conversations`, `flashcard_decks`, `flashcards`, `flyway_schema_history`, `image_recognitions`, `import_jobs`, `password_reset_tokens`, `quiz_answers`, `quiz_sessions`, `refresh_tokens`, `review_logs`, `shadowing_attempts`, `shadowing_dialogue_lines`, `shadowing_lessons`, `system_settings`, `topics`, `user_daily_stats`, `user_vocabularies`, `users`, `vocabularies`, `youtube_video_sentences`, `youtube_video_transcripts`.
- Bảng `flyway_schema_history` có đủ 9 bản ghi từ `version = 1` đến `version = 9` với cột `success = t`.

---

## 10. Dữ liệu ban đầu (Seed Data)

Dự án **đã tích hợp sẵn cơ chế nạp dữ liệu ban đầu tự động** (không cần chạy thêm script SQL rời) thông qua 2 lớp:
1. **Flyway Migrations (`V2`, `V3`, `V4`, `V5`, `V8`)**:
   - 8 cấu hình hệ thống trong `system_settings` (`ai.model.vision`, `ai.model.chat` = `gemini-3-flash-preview`, hạn mức AI `30` lượt/ngày...).
   - 8 chủ đề từ vựng trong `topics`.
   - 100+ từ vựng mẫu chuẩn JLPT trong `vocabularies`.
   - 3 bộ thẻ mẫu hệ thống (`N5`, `N4`, `N3`) trong `flashcard_decks` và các thẻ tương ứng trong `flashcards`.
   - 7 bài Shadowing trong `shadowing_lessons` (gồm 5 bài câu đơn N5 và 2 bài hội thoại nhiều lượt A/B trong `shadowing_dialogue_lines`).
   - 7 chủ đề hội thoại AI bao phủ đủ `N5` → `N1` trong `conversation_topics`.
2. **`DataInitializer.java` (`CommandLineRunner`)**:
   - Chạy mỗi lần Backend khởi động để đảm bảo tài khoản khởi tạo, 4 cấu hình AI cơ bản và các chủ đề mặc định luôn tồn tại (idempotent — không ghi đè dữ liệu đã có).

Kiểm tra nhanh số dòng dữ liệu mẫu sau khi chạy Backend lần đầu:
```sql
SELECT 'topics' AS tbl, COUNT(*) FROM topics
UNION ALL SELECT 'vocabularies', COUNT(*) FROM vocabularies
UNION ALL SELECT 'flashcard_decks', COUNT(*) FROM flashcard_decks
UNION ALL SELECT 'flashcards', COUNT(*) FROM flashcards
UNION ALL SELECT 'shadowing_lessons', COUNT(*) FROM shadowing_lessons
UNION ALL SELECT 'conversation_topics', COUNT(*) FROM conversation_topics
UNION ALL SELECT 'system_settings', COUNT(*) FROM system_settings;
```

---

## 11. Tạo tài khoản ADMIN theo cơ chế thực tế

Trong mã nguồn thực tế (`backend/src/main/java/vn/vku/nihongoai/config/DataInitializer.java`), tài khoản `ADMIN` được khởi tạo tự động khi Backend chạy lần đầu theo 2 biến môi trường trong `.env`:

```env
ADMIN_EMAIL=admin@nihongoai.local
ADMIN_PASSWORD=<dat_mat_khau_manh_cua_ban>
```

### Cách hoạt động chính xác của `DataInitializer.java`
1. Kiểm tra `userRepository.existsByEmail(cleanAdminEmail)`.
2. Nếu chưa tồn tại, tạo bản ghi mới trong bảng `users` với `role = 'ADMIN'`, `status = 'ACTIVE'`, `jlpt_level = 'N1'`, `daily_goal_cards = 50` và mã hóa mật khẩu bằng `BCryptPasswordEncoder(10)`.
3. Đồng thời tạo tài khoản học viên mẫu (`user@nihongoai.local`, `role = 'USER'`) nếu chưa tồn tại để kiểm thử luồng học tập (khuyến nghị đổi mật khẩu hoặc khóa tài khoản thử nghiệm này trước khi đưa lên môi trường thật).

### Trường hợp bạn muốn nâng quyền một tài khoản có sẵn lên `ADMIN` bằng SQL
Nếu đã đăng ký một tài khoản bình thường qua giao diện `/register` và muốn cấp quyền `ADMIN`:
```sql
UPDATE users
SET role = 'ADMIN', updated_at = CURRENT_TIMESTAMP
WHERE email = 'email-cua-ban@example.com';
```

---

## 12. Kiểm tra kết nối Backend

Sau khi khởi động Backend (`.\mvnw.cmd spring-boot:run` hoặc `java -jar target/nihongoai-0.0.1-SNAPSHOT.jar`), quan sát console để xác nhận 4 mốc thành công liên tiếp:

```text
HikariPool-1 - Start completed.
o.f.c.i.database.base.BaseDatabaseType : Database: jdbc:postgresql://localhost:5432/nihongoai (PostgreSQL 16.x)
o.f.core.internal.command.DbMigrate    : Current version of schema "public": 9
vn.vku.nihongoai.NihongoAiApplication  : Started NihongoAiApplication in ... seconds
```

Kiểm tra nhanh bằng lệnh HTTP:
```powershell
# PowerShell
Invoke-WebRequest -Uri "http://localhost:8080/v3/api-docs" -UseBasicParsing | Select-Object StatusCode
```
```bash
# Ubuntu / Bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/v3/api-docs
```
Nếu trả về `200`, Backend đã kết nối PostgreSQL, vượt qua Hibernate validate và sẵn sàng phục vụ API.

---

## 13. Backup Database

> **Lưu ý**: Không lưu file backup vào Git. File `.gitignore` của dự án đã cấu hình loại trừ `*.dump`.

### 13.1. Backup định dạng nén Custom `.dump` (Khuyến nghị — nhanh, nhẹ, dễ khôi phục)

**Windows (PowerShell):**
```powershell
$ts = Get-Date -Format "yyyyMMdd_HHmm"
pg_dump -U postgres -h localhost -p 5432 -F c -b -v -f "nihongoai_$ts.dump" nihongoai
```

**Ubuntu:**
```bash
sudo -u postgres pg_dump -F c -b -v -f "nihongoai_$(date +%Y%m%d_%H%M).dump" nihongoai
```

### 13.2. Backup định dạng SQL thuần (`.sql`) — dễ đọc và kiểm tra bằng trình soạn thảo

**Windows (PowerShell):**
```powershell
pg_dump -U postgres -h localhost -p 5432 -F p --encoding=UTF8 -f "nihongoai_backup.sql" nihongoai
```

**Ubuntu:**
```bash
sudo -u postgres pg_dump -F p --encoding=UTF8 -f "nihongoai_backup.sql" nihongoai
```

### 13.3. Backup khi đang chạy PostgreSQL bằng Docker Compose
```bash
docker exec -t nihongoai-postgres pg_dump -U postgres -F c nihongoai > nihongoai_docker.dump
```

---

## 14. Restore Database

> **Cảnh báo an toàn**: Luôn sao lưu database hiện tại trước khi restore. Tuyệt đối không chạy lệnh `DROP DATABASE` trên dữ liệu đang sử dụng nếu chưa có bản sao lưu đã kiểm chứng.

### 14.1. Restore từ file `.dump` vào database mới
1. Tạo database mới tên `nihongoai` (xem Mục 5).
2. Nạp dữ liệu từ file `.dump`:

**Windows (PowerShell):**
```powershell
pg_restore -U postgres -h localhost -p 5432 -d nihongoai --no-owner --no-acl -v "nihongoai_backup.dump"
```

**Ubuntu:**
```bash
sudo -u postgres pg_restore -d nihongoai --no-owner --no-acl -v "nihongoai_backup.dump"
```

*(Nếu muốn khôi phục lại bằng user ứng dụng `pq_nihongo_user`, thêm `-U pq_nihongo_user` hoặc chuyển quyền sở hữu bảng sau khi restore.)*

### 14.2. Restore từ file `.sql` thuần
```bash
# Windows:
psql -U postgres -h localhost -p 5432 -d nihongoai -f "nihongoai_backup.sql"

# Ubuntu:
sudo -u postgres psql -d nihongoai -f "nihongoai_backup.sql"
```

### 14.3. Restore vào container Docker PostgreSQL
```bash
docker cp nihongoai_backup.dump nihongoai-postgres:/tmp/nihongoai_backup.dump
docker exec -it nihongoai-postgres pg_restore -U postgres -d nihongoai --no-owner --no-acl /tmp/nihongoai_backup.dump
```

---

## 15. Chuyển Database sang máy khác

Để chuyển **trọn vẹn dữ liệu** PQ Nihongo (gồm tài khoản, từ vựng, lịch sử SRS, hội thoại AI, cache YouTube **và** ảnh đại diện/ảnh nhận diện) từ **Máy A** sang **Máy B**:

1. **Trên Máy A (máy nguồn)**:
   - Dừng Backend (nếu đang chạy) để đảm bảo dữ liệu nhất quán.
   - Chạy `pg_dump` tạo file `nihongoai_migration.dump` (theo Mục 13.1).
   - Nén thư mục ảnh thực tế `backend/uploads/` (chứa `avatars/` và `recog/`) thành `uploads_backup.zip`.
2. **Chép 2 file** (`nihongoai_migration.dump` và `uploads_backup.zip`) sang **Máy B** qua USB, mạng LAN hoặc lưu trữ đám mây riêng tư.
3. **Trên Máy B (máy đích)**:
   - Cài đặt PostgreSQL 16 (Mục 3 hoặc Mục 4).
   - Tạo database trống `nihongoai` chuẩn UTF-8 (Mục 5).
   - Chạy `pg_restore` nạp file `nihongoai_migration.dump` vào `nihongoai` (Mục 14.1).
   - Giải nén `uploads_backup.zip` vào đúng thư mục `backend/uploads/` của dự án.
   - Tạo file `.env` từ `.env.example` và điền thông tin kết nối PostgreSQL, `APP_JWT_SECRET`, `GEMINI_API_KEY` của Máy B.
   - Khởi động Backend → xác nhận log báo `Current version of schema "public": 9` và `Schema "public" is up to date`.

---

## 16. Kết nối Database từ máy khác (Mạng LAN / Server)

Mặc định PostgreSQL chỉ lắng nghe trên `localhost` (`127.0.0.1`). Chỉ mở kết nối từ máy khác khi bạn cần đặt Backend và PostgreSQL ở 2 máy khác nhau:

### Bước 1: Sửa `postgresql.conf`
- **Windows**: `C:\Program Files\PostgreSQL\16\data\postgresql.conf`
- **Ubuntu**: `/etc/postgresql/16/main/postgresql.conf`

Tìm và sửa dòng:
```ini
listen_addresses = '*'
```

### Bước 2: Sửa `pg_hba.conf` (chỉ cho phép dải IP mạng nội bộ đáng tin cậy)
- **Windows**: `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`
- **Ubuntu**: `/etc/postgresql/16/main/pg_hba.conf`

Thêm dòng ở cuối file (ví dụ mạng LAN `192.168.1.0/24`, dùng cơ chế xác thực hiện đại `scram-sha-256`):
```text
host    nihongoai    all    192.168.1.0/24    scram-sha-256
```

### Bước 3: Mở tường lửa cổng `5432` và khởi động lại PostgreSQL
**Ubuntu:**
```bash
sudo ufw allow from 192.168.1.0/24 to any port 5432 proto tcp
sudo systemctl restart postgresql
```
**Windows (PowerShell Run as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "PostgreSQL 5432 LAN" -Direction Inbound -Protocol TCP -LocalPort 5432 -RemoteAddress 192.168.1.0/24 -Action Allow
Restart-Service postgresql-x64-16
```

### Bước 4: Cập nhật `SPRING_DATASOURCE_URL` trên máy chạy Backend
```env
SPRING_DATASOURCE_URL=jdbc:postgresql://<IP_MAY_POSTGRES>:5432/nihongoai
```

---

## 17. Các lỗi thường gặp và cách xử lý

| Lỗi gặp phải | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| `'psql' is not recognized as an internal or external command` (Windows) | Chưa thêm `C:\Program Files\PostgreSQL\16\bin` vào biến `PATH` | Làm lại Bước 3.2 và đóng/mở lại PowerShell. |
| `FATAL: database "nihongoai" does not exist` | Chưa tạo database trước khi chạy Backend | Thực hiện Mục 5 (`CREATE DATABASE nihongoai WITH ENCODING 'UTF8';`). |
| `FATAL: password authentication failed for user "postgres"` | Mật khẩu trong `.env` không khớp mật khẩu PostgreSQL | Kiểm tra lại `SPRING_DATASOURCE_PASSWORD` trong `.env` hoặc đặt lại mật khẩu user `postgres`. |
| `ERROR: permission denied for schema public` | User ứng dụng mới tạo chưa được cấp quyền `CREATE` trên schema `public` (PostgreSQL 15/16) | Đăng nhập bằng `postgres` và chạy `GRANT ALL ON SCHEMA public TO <ten_user>;` (Mục 6). |
| `Connection to localhost:5432 refused` | Service PostgreSQL đang dừng hoặc nghe sai cổng | Kiểm tra `Get-Service *postgres*` (Windows) hoặc `systemctl status postgresql` (Ubuntu) và khởi động lại dịch vụ. |
| `FlywayValidateException: Migration checksum mismatch` | Có người sửa tay file `V1`..`V9` sau khi migration đã chạy | Khôi phục file SQL về nguyên bản; chỉ thêm file mới `V10__...sql` cho thay đổi mới. Không xóa dữ liệu thật. |
| `SchemaManagementException: Schema-validation: wrong column type` | Chưa chạy hết migration đến `V9` hoặc sửa cột thủ công khác Entity Java | Kiểm tra `SELECT * FROM flyway_schema_history;` xem migration nào chưa chạy hoặc bị lỗi, xử lý lỗi rồi khởi động lại Backend. |
| `pg_restore: error: could not execute query: ERROR: role "..." does not exist` | Restore file dump chứa chủ sở hữu cũ từ máy khác | Luôn thêm cờ `--no-owner --no-acl` khi chạy `pg_restore` (Mục 14.1). |
