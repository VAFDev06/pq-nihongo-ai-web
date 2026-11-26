package vn.vku.nihongoai.shadowing;

import com.atilika.kuromoji.ipadic.Token;
import com.atilika.kuromoji.ipadic.Tokenizer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vku.nihongoai.furigana.FuriganaService;
import vn.vku.nihongoai.shadowing.dto.WordDiffItem;
import vn.vku.nihongoai.shadowing.dto.WordDiffStatus;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
public class ShadowingScoringService {

    private final Tokenizer tokenizer;

    public ShadowingScoringService(FuriganaService furiganaService) {
        this.tokenizer = furiganaService.getTokenizer();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScoreResult {
        private double accuracy;
        private List<WordDiffItem> wordDiff;
    }

    public ScoreResult score(String targetJa, String recognizedJa) {
        if (targetJa == null || targetJa.isBlank()) {
            return ScoreResult.builder().accuracy(0.0).wordDiff(List.of()).build();
        }
        if (recognizedJa == null || recognizedJa.isBlank()) {
            List<Token> targetTokens = tokenizeClean(targetJa);
            List<WordDiffItem> diff = targetTokens.stream()
                    .map(t -> WordDiffItem.builder().text(t.getSurface()).status(WordDiffStatus.MISSING).build())
                    .toList();
            return ScoreResult.builder().accuracy(0.0).wordDiff(diff).build();
        }

        List<Token> originalTokens = tokenizeClean(targetJa);
        List<Token> userTokens = tokenizeClean(recognizedJa);

        if (originalTokens.isEmpty()) {
            return ScoreResult.builder().accuracy(100.0).wordDiff(List.of()).build();
        }

        int m = originalTokens.size();
        int n = userTokens.size();

        // Levenshtein DP table
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 0; i <= m; i++) dp[i][0] = i;
        for (int j = 0; j <= n; j++) dp[0][j] = j;

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (isMatch(originalTokens.get(i - 1), userTokens.get(j - 1))) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    int replaceCost = dp[i - 1][j - 1] + 1;
                    int deleteCost = dp[i - 1][j] + 1;
                    int insertCost = dp[i][j - 1] + 1;
                    dp[i][j] = Math.min(replaceCost, Math.min(deleteCost, insertCost));
                }
            }
        }

        // Traceback alignment
        List<WordDiffItem> diff = new ArrayList<>();
        int i = m;
        int j = n;
        int correctCount = 0;

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && isMatch(originalTokens.get(i - 1), userTokens.get(j - 1))) {
                diff.add(WordDiffItem.builder()
                        .text(originalTokens.get(i - 1).getSurface())
                        .status(WordDiffStatus.CORRECT)
                        .build());
                correctCount++;
                i--;
                j--;
            } else if (i > 0 && j > 0 && dp[i][j] == dp[i - 1][j - 1] + 1) {
                diff.add(WordDiffItem.builder()
                        .text(originalTokens.get(i - 1).getSurface())
                        .status(WordDiffStatus.WRONG)
                        .heard(userTokens.get(j - 1).getSurface())
                        .build());
                i--;
                j--;
            } else if (i > 0 && dp[i][j] == dp[i - 1][j] + 1) {
                diff.add(WordDiffItem.builder()
                        .text(originalTokens.get(i - 1).getSurface())
                        .status(WordDiffStatus.MISSING)
                        .build());
                i--;
            } else {
                diff.add(WordDiffItem.builder()
                        .text(userTokens.get(j - 1).getSurface())
                        .status(WordDiffStatus.EXTRA)
                        .build());
                j--;
            }
        }

        Collections.reverse(diff);
        double accuracy = Math.round(((double) correctCount / originalTokens.size() * 100.0) * 10.0) / 10.0;

        return ScoreResult.builder()
                .accuracy(Math.min(100.0, Math.max(0.0, accuracy)))
                .wordDiff(diff)
                .build();
    }

    private boolean isMatch(Token t1, Token t2) {
        String s1 = normalize(t1.getSurface());
        String s2 = normalize(t2.getSurface());
        if (s1.equals(s2)) return true;

        String r1 = t1.getReading();
        String r2 = t2.getReading();
        if (r1 != null && r2 != null && !r1.equals("*") && !r2.equals("*")) {
            return FuriganaService.katakanaToHiragana(r1).equals(FuriganaService.katakanaToHiragana(r2));
        }
        return false;
    }

    private List<Token> tokenizeClean(String text) {
        String clean = normalize(text);
        List<Token> raw = tokenizer.tokenize(clean);
        List<Token> filtered = new ArrayList<>();
        for (Token t : raw) {
            String surface = t.getSurface().trim();
            if (!surface.isEmpty() && !surface.matches("^[\\s、。！？!?,.·・~〜…—\\-]+$")) {
                filtered.add(t);
            }
        }
        return filtered;
    }

    public static String normalize(String s) {
        if (s == null) return "";
        String nfkc = Normalizer.normalize(s, Normalizer.Form.NFKC);
        return nfkc.replaceAll("[\\s、。！？!?,.·・~〜…—\\-]+", "");
    }
}
