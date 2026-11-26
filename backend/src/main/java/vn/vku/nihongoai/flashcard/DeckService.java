package vn.vku.nihongoai.flashcard;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.flashcard.dto.*;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;
import vn.vku.nihongoai.vocab.Topic;
import vn.vku.nihongoai.vocab.TopicRepository;
import vn.vku.nihongoai.vocab.UserVocabulary;
import vn.vku.nihongoai.vocab.UserVocabularyRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DeckService {

    private final DeckRepository deckRepository;
    private final FlashcardRepository flashcardRepository;
    private final CardProgressRepository cardProgressRepository;
    private final TopicRepository topicRepository;
    private final UserVocabularyRepository userVocabularyRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<DeckDto> getDecks(Long userId, String scope) {
        List<Deck> decks;
        if ("mine".equalsIgnoreCase(scope)) {
            decks = deckRepository.findMyDecks(userId);
        } else if ("system".equalsIgnoreCase(scope) || "public".equalsIgnoreCase(scope)) {
            decks = deckRepository.findPublicDecks();
        } else {
            decks = deckRepository.findAccessibleDecks(userId);
        }

        Instant now = Instant.now();
        List<DeckDto> result = new ArrayList<>();
        for (Deck deck : decks) {
            result.add(buildDeckDtoWithSrsCounts(deck, userId, now));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public DeckDto getDeckDetail(Long userId, Long deckId) {
        Deck deck = getAccessibleDeckOrThrow(deckId, userId);
        return buildDeckDtoWithSrsCounts(deck, userId, Instant.now());
    }

    private DeckDto buildDeckDtoWithSrsCounts(Deck deck, Long userId, Instant now) {
        long total = flashcardRepository.countByDeckId(deck.getId());
        long due = cardProgressRepository.countDueByDeckId(userId, deck.getId(), now);
        long syncedLevel0 = cardProgressRepository.countByUserAndLevel(userId, deck.getId(), 0);
        long unsyncedNew = flashcardRepository.countNewCardsByDeckId(userId, deck.getId());
        long level0Count = syncedLevel0 + unsyncedNew;
        long learningCount = cardProgressRepository.countLearningLevels1To4(userId, deck.getId());
        long masteredCount = cardProgressRepository.countByUserAndLevel(userId, deck.getId(), 5);
        return DeckDto.from(deck, userId, total, due, level0Count, learningCount, masteredCount);
    }

    @Transactional
    public DeckDto createDeck(Long userId, CreateDeckRequest request) {
        User user = userService.getUserOrThrow(userId);
        Topic topic = null;
        if (request.getTopicId() != null) {
            topic = topicRepository.findById(request.getTopicId()).orElse(null);
        }

        Deck deck = Deck.builder()
                .owner(user)
                .name(request.getName().trim())
                .description(request.getDescription())
                .jlptLevel(request.getJlptLevel())
                .topic(topic)
                .isSystem(false)
                .isPublic(Boolean.TRUE.equals(request.getIsPublic()))
                .isActive(true)
                .build();

        deck = deckRepository.save(deck);
        return DeckDto.from(deck, userId, 0, 0);
    }

    @Transactional
    public DeckDto updateDeck(Long userId, Long deckId, CreateDeckRequest request) {
        Deck deck = getMyDeckOrThrow(deckId, userId);

        deck.setName(request.getName().trim());
        deck.setDescription(request.getDescription());
        deck.setJlptLevel(request.getJlptLevel());
        if (request.getIsPublic() != null) {
            deck.setIsPublic(request.getIsPublic());
        }
        if (request.getTopicId() != null) {
            Topic topic = topicRepository.findById(request.getTopicId()).orElse(null);
            deck.setTopic(topic);
        }

        deck = deckRepository.save(deck);
        long total = flashcardRepository.countByDeckId(deck.getId());
        long due = cardProgressRepository.countDueByDeckId(userId, deck.getId(), Instant.now());
        return DeckDto.from(deck, userId, total, due);
    }

    @Transactional
    public void deleteDeck(Long userId, Long deckId) {
        Deck deck = getMyDeckOrThrow(deckId, userId);
        deckRepository.delete(deck);
    }

    @Transactional
    public DeckDto cloneDeck(Long userId, Long deckId) {
        User user = userService.getUserOrThrow(userId);
        Deck source = getAccessibleDeckOrThrow(deckId, userId);

        Deck copy = Deck.builder()
                .owner(user)
                .name(source.getName() + " (Bản sao)")
                .description(source.getDescription())
                .jlptLevel(source.getJlptLevel())
                .topic(source.getTopic())
                .isSystem(false)
                .isPublic(false)
                .isActive(true)
                .build();

        copy = deckRepository.save(copy);

        List<Flashcard> sourceCards = flashcardRepository.findAllByDeckIdOrderByPositionAsc(source.getId());
        for (Flashcard sc : sourceCards) {
            Flashcard fc = Flashcard.builder()
                    .deck(copy)
                    .front(sc.getFront())
                    .reading(sc.getReading())
                    .back(sc.getBack())
                    .partOfSpeech(sc.getPartOfSpeech())
                    .hanViet(sc.getHanViet())
                    .exampleJa(sc.getExampleJa())
                    .exampleVi(sc.getExampleVi())
                    .exampleReading(sc.getExampleReading())
                    .imageUrl(sc.getImageUrl())
                    .note(sc.getNote())
                    .position(sc.getPosition())
                    .build();
            flashcardRepository.save(fc);
        }

        return DeckDto.from(copy, userId, sourceCards.size(), 0);
    }

    @Transactional(readOnly = true)
    public List<FlashcardDto> getCards(Long userId, Long deckId) {
        getAccessibleDeckOrThrow(deckId, userId);
        return flashcardRepository.findAllByDeckIdOrderByPositionAsc(deckId)
                .stream()
                .map(FlashcardDto::from)
                .toList();
    }

    @Transactional
    public FlashcardDto addCard(Long userId, Long deckId, CreateFlashcardRequest request) {
        Deck deck = getMyDeckOrThrow(deckId, userId);

        flashcardRepository.findByDeckIdAndFrontAndReading(deckId, request.getFront().trim(), request.getReading())
                .ifPresent(existing -> {
                    throw new AppException(ErrorCode.DUPLICATE_RESOURCE, "Thẻ này đã tồn tại trong bộ");
                });

        int nextPos = (int) flashcardRepository.countByDeckId(deckId) + 1;

        Flashcard card = Flashcard.builder()
                .deck(deck)
                .front(request.getFront().trim())
                .reading(request.getReading() != null ? request.getReading().trim() : null)
                .back(request.getBack().trim())
                .partOfSpeech(request.getPartOfSpeech() != null && !request.getPartOfSpeech().isBlank() ? request.getPartOfSpeech().trim() : null)
                .hanViet(request.getHanViet() != null && !request.getHanViet().isBlank() ? request.getHanViet().trim() : null)
                .exampleJa(request.getExampleJa())
                .exampleVi(request.getExampleVi())
                .exampleReading(request.getExampleReading())
                .imageUrl(request.getImageUrl())
                .note(request.getNote())
                .position(nextPos)
                .build();

        card = flashcardRepository.save(card);
        return FlashcardDto.from(card);
    }

    @Transactional
    public List<FlashcardDto> addCardsFromVocab(Long userId, Long deckId, AddCardsFromVocabRequest request) {
        Deck deck = getMyDeckOrThrow(deckId, userId);
        List<FlashcardDto> created = new ArrayList<>();
        int nextPos = (int) flashcardRepository.countByDeckId(deckId);

        for (Long uvId : request.getUserVocabularyIds()) {
            UserVocabulary uv = userVocabularyRepository.findByIdAndUserId(uvId, userId).orElse(null);
            if (uv != null) {
                boolean exists = flashcardRepository.findByDeckIdAndFrontAndReading(deckId, uv.getWord(), uv.getReading()).isPresent();
                if (!exists) {
                    nextPos++;
                    Flashcard card = Flashcard.builder()
                            .deck(deck)
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
                    created.add(FlashcardDto.from(card));
                }
            }
        }
        return created;
    }

    @Transactional
    public FlashcardDto updateCard(Long userId, Long cardId, CreateFlashcardRequest request) {
        Flashcard card = flashcardRepository.findById(cardId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy thẻ flashcard"));

        getMyDeckOrThrow(card.getDeck().getId(), userId);

        card.setFront(request.getFront().trim());
        card.setReading(request.getReading() != null ? request.getReading().trim() : null);
        card.setBack(request.getBack().trim());
        card.setPartOfSpeech(request.getPartOfSpeech() != null && !request.getPartOfSpeech().isBlank() ? request.getPartOfSpeech().trim() : null);
        card.setHanViet(request.getHanViet() != null && !request.getHanViet().isBlank() ? request.getHanViet().trim() : null);
        card.setExampleJa(request.getExampleJa());
        card.setExampleVi(request.getExampleVi());
        card.setExampleReading(request.getExampleReading());
        card.setImageUrl(request.getImageUrl());
        card.setNote(request.getNote());

        card = flashcardRepository.save(card);
        return FlashcardDto.from(card);
    }

    @Transactional
    public void deleteCard(Long userId, Long cardId) {
        Flashcard card = flashcardRepository.findById(cardId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy thẻ flashcard"));

        getMyDeckOrThrow(card.getDeck().getId(), userId);
        flashcardRepository.delete(card);
    }

    public Deck getAccessibleDeckOrThrow(Long deckId, Long userId) {
        Deck deck = deckRepository.findByIdAndIsActiveTrue(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));

        if (Boolean.TRUE.equals(deck.getIsSystem())) {
            if (deck.getStatus() != DeckStatus.PUBLISHED || !Boolean.TRUE.equals(deck.getIsPublic())) {
                throw new AppException(ErrorCode.NOT_FOUND, "Bộ thẻ mẫu này chưa được xuất bản hoặc đã được lưu trữ");
            }
            return deck;
        }

        if (!Boolean.TRUE.equals(deck.getIsPublic())) {
            if (deck.getOwner() == null || !deck.getOwner().getId().equals(userId)) {
                throw new AppException(ErrorCode.FORBIDDEN, "Bạn không có quyền truy cập bộ flashcard này");
            }
        }
        return deck;
    }

    public Deck getMyDeckOrThrow(Long deckId, Long userId) {
        Deck deck = deckRepository.findByIdAndIsActiveTrue(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));

        if (deck.getOwner() == null || !deck.getOwner().getId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Bạn chỉ có thể chỉnh sửa bộ thẻ do chính mình tạo");
        }
        return deck;
    }
}
