package vn.vku.nihongoai.furigana;

import com.atilika.kuromoji.ipadic.Token;
import com.atilika.kuromoji.ipadic.Tokenizer;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class FuriganaService {

    private final Tokenizer tokenizer;

    public FuriganaService() {
        this.tokenizer = new Tokenizer();
    }

    public List<FuriganaToken> generateFurigana(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }

        List<Token> tokens = tokenizer.tokenize(text);
        List<FuriganaToken> result = new ArrayList<>();

        for (Token token : tokens) {
            String surface = token.getSurface();
            String readingKatakana = token.getReading();
            boolean hasKanji = containsKanji(surface);

            String readingHiragana = null;
            if (hasKanji && readingKatakana != null && !readingKatakana.equals("*")) {
                readingHiragana = katakanaToHiragana(readingKatakana);
            }

            result.add(FuriganaToken.builder()
                    .surface(surface)
                    .reading(readingHiragana)
                    .hasKanji(hasKanji)
                    .build());
        }

        return result;
    }

    public Tokenizer getTokenizer() {
        return tokenizer;
    }

    public String toFullHiragana(String text) {
        if (text == null || text.isBlank()) return "";
        StringBuilder sb = new StringBuilder();
        for (Token token : tokenizer.tokenize(text)) {
            String reading = token.getReading();
            if (reading != null && !reading.equals("*") && !reading.isBlank()) {
                sb.append(katakanaToHiragana(reading));
            } else {
                sb.append(katakanaToHiragana(token.getSurface()));
            }
        }
        return sb.toString();
    }

    public static boolean containsKanji(String s) {
        if (s == null) return false;
        for (char c : s.toCharArray()) {
            Character.UnicodeBlock block = Character.UnicodeBlock.of(c);
            if (block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS ||
                block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A ||
                block == Character.UnicodeBlock.CJK_COMPATIBILITY_IDEOGRAPHS) {
                return true;
            }
        }
        return false;
    }

    public static String katakanaToHiragana(String s) {
        if (s == null) return null;
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c >= '\u30A1' && c <= '\u30F6') {
                sb.append((char) (c - 0x60));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
