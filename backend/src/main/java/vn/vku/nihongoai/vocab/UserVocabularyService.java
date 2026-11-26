package vn.vku.nihongoai.vocab;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.flashcard.*;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;
import vn.vku.nihongoai.vocab.dto.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class UserVocabularyService {

    private final UserVocabularyRepository userVocabularyRepository;
    private final VocabularyService vocabularyService;
    private final UserService userService;
    private final DeckRepository deckRepository;
    private final FlashcardRepository flashcardRepository;
    private final CardProgressRepository cardProgressRepository;
    @org.springframework.context.annotation.Lazy
    private final vn.vku.nihongoai.progress.ProgressService progressService;

    @Transactional(readOnly = true)
    public Page<UserVocabularyDto> searchMyVocab(Long userId, String q, Boolean isMastered, VocabSource source, Pageable pageable) {
        String query = (q != null && !q.isBlank()) ? q.trim() : "";
        return userVocabularyRepository.searchUserVocab(userId, query, isMastered, source, pageable)
                .map(UserVocabularyDto::from);
    }

    @Transactional
    public UserVocabularyDto addVocab(Long userId, CreateUserVocabRequest request) {
        User user = userService.getUserOrThrow(userId);
        String cleanWord = request.getWord().trim();
        String cleanReading = (request.getReading() != null && !request.getReading().isBlank())
                ? request.getReading().trim()
                : null;

        userVocabularyRepository.findByUserIdAndWordAndReading(userId, cleanWord, cleanReading)
                .ifPresent(existing -> {
                    throw new AppException(ErrorCode.DUPLICATE_RESOURCE, "Từ này đã có trong sổ từ của bạn");
                });

        UserVocabulary uv = UserVocabulary.builder()
                .user(user)
                .word(cleanWord)
                .reading(cleanReading)
                .romaji(request.getRomaji() != null && !request.getRomaji().isBlank() ? request.getRomaji().trim() : null)
                .meaningVi(request.getMeaningVi().trim())
                .partOfSpeech(request.getPartOfSpeech() != null && !request.getPartOfSpeech().isBlank() ? request.getPartOfSpeech().trim() : null)
                .hanViet(request.getHanViet() != null && !request.getHanViet().isBlank() ? request.getHanViet().trim() : null)
                .jlptLevel(request.getJlptLevel() != null && !request.getJlptLevel().isBlank() ? request.getJlptLevel().trim() : null)
                .exampleJa(request.getExampleJa())
                .exampleVi(request.getExampleVi())
                .exampleReading(request.getExampleReading())
                .imageUrl(request.getImageUrl())
                .note(request.getNote())
                .source(request.getSource() != null ? request.getSource() : VocabSource.MANUAL)
                .isMastered(false)
                .build();

        uv = userVocabularyRepository.save(uv);
        if (progressService != null) {
            progressService.recordActivity(userId, "WORD_ADDED", 1);
        }
        return UserVocabularyDto.from(uv);
    }

    @Transactional
    public List<UserVocabularyDto> addBulk(Long userId, BulkSaveVocabRequest request) {
        User user = userService.getUserOrThrow(userId);
        List<UserVocabularyDto> saved = new ArrayList<>();

        for (CreateUserVocabRequest item : request.getItems()) {
            if (item.getWord() == null || item.getWord().isBlank() || item.getMeaningVi() == null || item.getMeaningVi().isBlank()) {
                continue;
            }
            String cleanWord = item.getWord().trim();
            String cleanReading = (item.getReading() != null && !item.getReading().isBlank()) ? item.getReading().trim() : null;

            boolean exists = userVocabularyRepository.findByUserIdAndWordAndReading(userId, cleanWord, cleanReading).isPresent()
                    || userVocabularyRepository.findFirstByUserIdAndWord(userId, cleanWord).isPresent();

            if (!exists) {
                UserVocabulary uv = UserVocabulary.builder()
                        .user(user)
                        .word(cleanWord)
                        .reading(cleanReading)
                        .romaji(item.getRomaji() != null && !item.getRomaji().isBlank() ? item.getRomaji().trim() : null)
                        .meaningVi(item.getMeaningVi().trim())
                        .partOfSpeech(item.getPartOfSpeech() != null && !item.getPartOfSpeech().isBlank() ? item.getPartOfSpeech().trim() : null)
                        .hanViet(item.getHanViet() != null && !item.getHanViet().isBlank() ? item.getHanViet().trim() : null)
                        .jlptLevel(item.getJlptLevel() != null && !item.getJlptLevel().isBlank() ? item.getJlptLevel().trim() : null)
                        .exampleJa(item.getExampleJa())
                        .exampleVi(item.getExampleVi())
                        .exampleReading(item.getExampleReading())
                        .imageUrl(item.getImageUrl())
                        .note(item.getNote())
                        .source(item.getSource() != null ? item.getSource() : VocabSource.AI_IMAGE)
                        .isMastered(false)
                        .build();

                uv = userVocabularyRepository.save(uv);
                saved.add(UserVocabularyDto.from(uv));
            }
        }
        if (!saved.isEmpty() && progressService != null) {
            progressService.recordActivity(userId, "WORD_ADDED", saved.size());
        }
        return saved;
    }

    @Transactional
    public Map<String, Object> addToSrs(Long userId, Map<String, Object> body) {
        User user = userService.getUserOrThrow(userId);
        boolean selectAll = Boolean.TRUE.equals(body.get("selectAll"));
        Long deckId = body.get("deckId") != null && !body.get("deckId").toString().isBlank()
                ? Long.valueOf(body.get("deckId").toString())
                : null;

        List<UserVocabulary> targetVocabs = new ArrayList<>();
        if (selectAll) {
            String q = body.get("q") != null ? body.get("q").toString().trim() : "";
            Boolean isMastered = body.get("isMastered") != null && !body.get("isMastered").toString().isBlank()
                    ? Boolean.valueOf(body.get("isMastered").toString())
                    : null;
            VocabSource source = null;
            if (body.get("source") != null && !body.get("source").toString().isBlank()) {
                try {
                    source = VocabSource.valueOf(body.get("source").toString());
                } catch (Exception ignored) {
                }
            }
            targetVocabs = userVocabularyRepository.searchUserVocab(userId, q, isMastered, source, Pageable.unpaged()).getContent();
        } else {
            Object rawIds = body.get("vocabIds");
            if (rawIds instanceof List<?> list) {
                for (Object idObj : list) {
                    if (idObj != null) {
                        Long uvId = Long.valueOf(idObj.toString());
                        userVocabularyRepository.findByIdAndUserId(uvId, userId).ifPresent(targetVocabs::add);
                    }
                }
            }
        }

        if (targetVocabs.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Không có từ vựng nào được chọn để thêm vào SRS");
        }

        Deck targetDeck = null;
        if (deckId != null) {
            targetDeck = deckRepository.findByIdAndIsActiveTrue(deckId)
                    .filter(d -> d.getOwner() != null && d.getOwner().getId().equals(userId))
                    .orElse(null);
        }
        if (targetDeck == null) {
            List<Deck> myDecks = deckRepository.findMyDecks(userId);
            targetDeck = myDecks.stream()
                    .filter(d -> "Sổ từ vựng SRS của tôi".equalsIgnoreCase(d.getName()))
                    .findFirst()
                    .orElseGet(() -> {
                        Deck created = Deck.builder()
                                .owner(user)
                                .name("Sổ từ vựng SRS của tôi")
                                .description("Bộ thẻ ôn tập ngắt quãng (SRS) tự động đồng bộ từ Sổ từ vựng cá nhân")
                                .jlptLevel(user.getJlptLevel())
                                .isSystem(false)
                                .isPublic(false)
                                .isActive(true)
                                .build();
                        return deckRepository.save(created);
                    });
        }

        int addedCount = 0;
        int existingCount = 0;
        int nextPos = (int) flashcardRepository.countByDeckId(targetDeck.getId());
        Instant now = Instant.now();

        for (UserVocabulary uv : targetVocabs) {
            var existingCardOpt = flashcardRepository.findByDeckIdAndFrontAndReading(
                    targetDeck.getId(), uv.getWord(), uv.getReading());

            if (existingCardOpt.isPresent()) {
                existingCount++;
                Flashcard existingCard = existingCardOpt.get();
                // Giữ nguyên lịch sử SRS nếu đã có, chỉ khởi tạo nếu chưa có CardProgress
                if (cardProgressRepository.findByUserIdAndFlashcardId(userId, existingCard.getId()).isEmpty()) {
                    CardProgress cp = CardProgress.builder()
                            .user(user)
                            .flashcard(existingCard)
                            .state(CardState.NEW)
                            .easeFactor(new BigDecimal("2.50"))
                            .intervalDays(0)
                            .repetitions(0)
                            .lapses(0)
                            .dueAt(now)
                            .build();
                    cardProgressRepository.save(cp);
                }
            } else {
                nextPos++;
                Flashcard card = Flashcard.builder()
                        .deck(targetDeck)
                        .userVocabulary(uv)
                        .front(uv.getWord())
                        .reading(uv.getReading())
                        .back(uv.getMeaningVi())
                        .partOfSpeech(uv.getPartOfSpeech())
                        .hanViet(uv.getHanViet())
                        .exampleJa(uv.getExampleJa())
                        .exampleVi(uv.getExampleVi())
                        .exampleReading(uv.getExampleReading())
                        .imageUrl(uv.getImageUrl())
                        .note(uv.getNote())
                        .position(nextPos)
                        .build();
                card = flashcardRepository.save(card);

                CardProgress cp = CardProgress.builder()
                        .user(user)
                        .flashcard(card)
                        .state(CardState.NEW)
                        .easeFactor(new BigDecimal("2.50"))
                        .intervalDays(0)
                        .repetitions(0)
                        .lapses(0)
                        .dueAt(now)
                        .build();
                cardProgressRepository.save(cp);
                addedCount++;
            }
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("addedCount", addedCount);
        res.put("existingCount", existingCount);
        res.put("totalSelected", targetVocabs.size());
        res.put("deckId", targetDeck.getId());
        res.put("deckName", targetDeck.getName());
        return res;
    }

    @Transactional
    public UserVocabularyDto updateVocab(Long userId, Long vocabId, UpdateUserVocabRequest request) {
        UserVocabulary uv = getUserVocabOrThrow(vocabId, userId);

        if (request.getWord() != null && !request.getWord().isBlank()) uv.setWord(request.getWord().trim());
        if (request.getReading() != null) uv.setReading(request.getReading().trim());
        if (request.getRomaji() != null) uv.setRomaji(request.getRomaji().trim());
        if (request.getMeaningVi() != null && !request.getMeaningVi().isBlank()) uv.setMeaningVi(request.getMeaningVi().trim());
        if (request.getPartOfSpeech() != null) uv.setPartOfSpeech(request.getPartOfSpeech().trim());
        if (request.getHanViet() != null) uv.setHanViet(request.getHanViet().trim());
        if (request.getJlptLevel() != null) uv.setJlptLevel(request.getJlptLevel().trim());
        if (request.getExampleJa() != null) uv.setExampleJa(request.getExampleJa());
        if (request.getExampleVi() != null) uv.setExampleVi(request.getExampleVi());
        if (request.getExampleReading() != null) uv.setExampleReading(request.getExampleReading());
        if (request.getImageUrl() != null) uv.setImageUrl(request.getImageUrl());
        if (request.getNote() != null) uv.setNote(request.getNote());
        if (request.getIsMastered() != null) uv.setIsMastered(request.getIsMastered());

        uv = userVocabularyRepository.save(uv);
        return UserVocabularyDto.from(uv);
    }

    @Transactional
    public UserVocabularyDto setMastered(Long userId, Long vocabId, boolean isMastered) {
        UserVocabulary uv = getUserVocabOrThrow(vocabId, userId);
        uv.setIsMastered(isMastered);
        uv = userVocabularyRepository.save(uv);
        return UserVocabularyDto.from(uv);
    }

    @Transactional
    public void deleteVocab(Long userId, Long vocabId) {
        UserVocabulary uv = getUserVocabOrThrow(vocabId, userId);
        userVocabularyRepository.delete(uv);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSavedSystemVocabKeys(Long userId) {
        List<Long> vocabularyIds = userVocabularyRepository.findSavedSystemVocabularyIds(userId);
        List<String> words = userVocabularyRepository.findSavedWords(userId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("vocabularyIds", vocabularyIds);
        result.put("words", words);
        result.put("totalSaved", words.size());
        return result;
    }

    @Transactional
    public UserVocabularyDto copyFromSystem(Long userId, Long systemVocabId) {
        User user = userService.getUserOrThrow(userId);
        Vocabulary sysVocab = vocabularyService.getVocabularyOrThrow(systemVocabId);

        Optional<UserVocabulary> existingOpt = userVocabularyRepository.findFirstByUserIdAndVocabularyId(userId, systemVocabId);
        if (existingOpt.isEmpty()) {
            existingOpt = userVocabularyRepository.findByUserIdAndWordAndReading(userId, sysVocab.getWord(), sysVocab.getReading());
        }
        if (existingOpt.isEmpty()) {
            existingOpt = userVocabularyRepository.findFirstByUserIdAndWord(userId, sysVocab.getWord());
        }

        if (existingOpt.isPresent()) {
            UserVocabulary existing = existingOpt.get();
            userVocabularyRepository.touchUpdatedAtAndLinkVocabulary(existing.getId(), sysVocab);
            existing.setVocabulary(sysVocab);
            existing.setUpdatedAt(Instant.now());
            return UserVocabularyDto.from(existing);
        }

        UserVocabulary uv = UserVocabulary.builder()
                .user(user)
                .vocabulary(sysVocab)
                .word(sysVocab.getWord())
                .reading(sysVocab.getReading())
                .romaji(sysVocab.getRomaji())
                .meaningVi(sysVocab.getMeaningVi())
                .partOfSpeech(sysVocab.getPartOfSpeech())
                .hanViet(sysVocab.getHanViet())
                .jlptLevel(sysVocab.getJlptLevel() != null ? sysVocab.getJlptLevel().name() : null)
                .exampleJa(sysVocab.getExampleJa())
                .exampleVi(sysVocab.getExampleVi())
                .exampleReading(sysVocab.getExampleReading())
                .imageUrl(sysVocab.getImageUrl())
                .source(VocabSource.SYSTEM)
                .isMastered(false)
                .build();

        uv = userVocabularyRepository.save(uv);
        if (progressService != null) {
            progressService.recordActivity(userId, "WORD_ADDED", 1);
        }
        return UserVocabularyDto.from(uv);
    }

    public UserVocabulary getUserVocabOrThrow(Long id, Long userId) {
        return userVocabularyRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy từ vựng trong sổ cá nhân"));
    }
}
