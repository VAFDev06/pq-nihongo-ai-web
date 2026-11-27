"""Learner-friendly Vietnamese feedback generator grounded strictly on evaluation metrics.

Default mode: deterministic Vietnamese templates (zero extra VRAM, zero hallucination).
Optional mode: locally deployed Qwen/Qwen3-4B when SHADOWING_FEEDBACK_MODEL_ENABLED=true.
NEVER asks any LLM to invent numeric scores or pretend it heard audio directly.
NEVER calls Gemini API.
"""
import json
import logging
import threading
from typing import List, Optional

from app.config.settings import Settings
from app.schemas.shadowing import (
    AsrSection,
    FeedbackExplanationItem,
    FeedbackSection,
    IntonationSection,
    PronunciationSection,
    ScoreBreakdown,
)
from app.services.asr_service import normalize_japanese_text
from app.services.device_manager import DeviceManager

logger = logging.getLogger(__name__)


class FeedbackService:
    def __init__(self, settings: Settings, device_manager: DeviceManager):
        self.settings = settings
        self.device_manager = device_manager
        self._tokenizer = None
        self._model = None
        self._load_lock = threading.Lock()
        self._last_error: Optional[str] = None

    @property
    def is_llm_loaded(self) -> bool:
        return self._model is not None

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    def _build_deterministic_feedback(
        self,
        reference_text: str,
        asr: AsrSection,
        scores: ScoreBreakdown,
        pronunciation: PronunciationSection,
        intonation: IntonationSection,
        jlpt_level: Optional[str] = None,
    ) -> FeedbackSection:
        explanations: List[FeedbackExplanationItem] = []
        suggestions: List[str] = []

        # 1. ASR text comparison (explicitly distinguishing ASR mismatch from guaranteed pronunciation error)
        ref_norm = normalize_japanese_text(reference_text)
        rec_norm = normalize_japanese_text(asr.recognizedText)
        if asr.available and not rec_norm:
            explanations.append(
                FeedbackExplanationItem(
                    category="ASR_DIFF",
                    incorrectFragment="(không nhận diện được)",
                    correctFragment=reference_text,
                    reason="Mô hình nhận diện giọng nói không nghe rõ câu tiếng Nhật trong bản ghi.",
                    suggestion="Đọc to, rõ từng âm tiết và giữ micro gần hơn, tránh tiếng ồn xung quanh.",
                )
            )
            suggestions.append("Nghe lại câu mẫu tốc độ 0.75x rồi đọc chậm từng cụm từ trước khi tăng tốc.")
        elif asr.available and ref_norm != rec_norm:
            explanations.append(
                FeedbackExplanationItem(
                    category="ASR_DIFF",
                    incorrectFragment=asr.recognizedText,
                    correctFragment=reference_text,
                    reason=(
                        "Văn bản ASR nhận diện có điểm khác với câu mẫu (có thể do thiếu/nhầm trợ từ, đọc nhanh "
                        "hoặc ASR nhầm âm tương tự — hãy xem đối chiếu từng từ bên dưới)."
                    ),
                    suggestion="So sánh phần từ bị thiếu/sai màu đỏ hoặc vàng và đọc lại chậm cụm từ đó 3 lần.",
                )
            )
            suggestions.append("Tập trung đọc rõ các trợ từ (は, を, に, で, が) và âm cuối câu.")

        # 2. Pronunciation / Mora / Special Mora / Pitch accent findings from hatsuon
        if pronunciation.available:
            mora_errors = [e for e in pronunciation.errors if e.type in ("MORA_MISPRONOUNCED", "MORA_DELETED")]
            special_errors = [e for e in pronunciation.errors if e.type == "SPECIAL_MORA_DURATION"]
            pitch_errors = [e for e in pronunciation.errors if e.type == "PITCH_ACCENT"]

            for err in mora_errors[:3]:
                explanations.append(
                    FeedbackExplanationItem(
                        category="MORA",
                        incorrectFragment=err.observed or f"({err.mora})",
                        correctFragment=f"{err.word} ({err.reading})" if err.reading else err.word,
                        reason=err.detail,
                        suggestion=f"Luyện tách từng mora của từ 「{err.word}」 và phát âm rõ âm 「{err.mora}」.",
                    )
                )

            for err in special_errors[:2]:
                explanations.append(
                    FeedbackExplanationItem(
                        category="SPECIAL_MORA",
                        incorrectFragment=f"{err.mora} ({err.observed})",
                        correctFragment=f"{err.word} ({err.reading})",
                        reason=err.detail,
                        suggestion=(
                            "Nhớ quy tắc mora đặc biệt tiếng Nhật: âm ngắt 「っ」 dừng đủ 1 nhịp, "
                            "trường âm 「ー」 kéo dài đủ 2 nhịp, âm mũi 「ん」 giữ tròn 1 nhịp."
                        ),
                    )
                )

            if special_errors:
                suggestions.append("Gõ nhịp bằng tay theo từng mora khi luyện từ chứa trường âm, 「っ」 và 「ん」.")

            for err in pitch_errors[:2]:
                explanations.append(
                    FeedbackExplanationItem(
                        category="PITCH_ACCENT",
                        incorrectFragment=err.observed,
                        correctFragment=f"{err.word} ({err.reading}) — {err.expected}",
                        reason=err.detail + " (Lưu ý: đánh giá trọng âm hatsuon đang ở giai đoạn alpha).",
                        suggestion=f"Nghe lại từ 「{err.word}」 và chú ý vị trí lên/xuống giọng theo chuẩn Tokyo.",
                    )
                )

            if pitch_errors:
                suggestions.append("Chú ý phân biệt cao-thấp giữa mora thứ 1 và thứ 2 của từ (trọng âm chuẩn Tokyo).")

        # 3. Experimental Sentence-Level Intonation & Pauses
        if intonation.f0Available:
            if intonation.finalPitchMatch is False:
                if intonation.expectedFinalMovement == "RISING":
                    explanations.append(
                        FeedbackExplanationItem(
                            category="INTONATION",
                            incorrectFragment=f"Cuối câu chưa lên giọng ({intonation.finalPitchMovement})",
                            correctFragment=reference_text,
                            reason="Câu hỏi tiếng Nhật thường cần nâng cao độ (F0) rõ ràng ở cuối câu.",
                            suggestion="Thử kéo cao giọng nhẹ ở âm tiết cuối cùng (ví dụ 「か？」).",
                        )
                    )
                    suggestions.append("Luyện nhấn lên giọng tự nhiên ở cuối câu nghi vấn.")
                else:
                    explanations.append(
                        FeedbackExplanationItem(
                            category="INTONATION",
                            incorrectFragment="Cuối câu trần thuật bị lên giọng",
                            correctFragment=reference_text,
                            reason="Câu khẳng định/trần thuật nên hạ nhẹ hoặc giữ ổn định cao độ ở cuối câu.",
                            suggestion="Thả lỏng hơi thở và hạ nhẹ giọng ở âm cuối cùng của câu.",
                        )
                    )

            excessive_pauses = [p for p in intonation.pauseAnalysis if p.severity == "EXCESSIVE"]
            if excessive_pauses:
                explanations.append(
                    FeedbackExplanationItem(
                        category="TIMING",
                        incorrectFragment=f"{len(excessive_pauses)} khoảng ngập ngừng dài (>0.65s)",
                        correctFragment="Nhịp nối cụm từ liền mạch",
                        reason="Ngắt nghỉ quá lâu giữa câu làm giảm độ trôi chảy khi Shadowing.",
                        suggestion="Đọc nhẩm trước cả câu để quen mặt chữ rồi luyện nối liền mạch không ngập ngừng.",
                    )
                )
                suggestions.append("Luyện đọc đuổi (Shadowing) ở tốc độ 0.75x để giảm khoảng ngập ngừng giữa câu.")

            if intonation.pitchStdSemitones is not None and intonation.pitchStdSemitones < 1.1:
                suggestions.append("Tăng độ biểu cảm cao độ nhẹ giữa các cụm từ để tránh giọng đọc quá phẳng.")

        if not suggestions:
            suggestions.append("Thử tăng tốc độ mẫu lên 1.0x hoặc 1.25x để rèn phản xạ Shadowing tự nhiên hơn.")

        # Summary & encouragement grounded strictly on available scores
        level_tag = f" (trình độ {jlpt_level})" if jlpt_level else ""
        if scores.overall is not None:
            if scores.overall >= 88:
                summary = (
                    f"Phát âm rất tốt{level_tag}! Điểm tổng quan ước lượng {scores.overall:.1f}/100 "
                    "với độ rõ âm tiết và nhịp điệu khá ổn định."
                )
                encouragement = "Tuyệt vời! Bạn đã nắm rất tốt câu này — hãy tiếp tục luyện thêm câu tiếp theo để duy trì phản xạ."
            elif scores.overall >= 70:
                summary = (
                    f"Phát âm ở mức khá{level_tag} ({scores.overall:.1f}/100). "
                    "Bạn đã đọc đúng phần lớn câu nhưng vẫn còn vài điểm về mora, trọng âm hoặc nhịp điệu cần tinh chỉnh."
                )
                encouragement = "Tiến bộ rất tốt! Chỉ cần chỉnh nhẹ các điểm gợi ý bên dưới rồi đọc lại 1–2 lần là sẽ mượt ngay."
            else:
                summary = (
                    f"Cần luyện thêm câu này{level_tag} (điểm tổng quan {scores.overall:.1f}/100). "
                    "Hãy tập trung nghe chậm và đọc rõ từng cụm từ trước."
                )
                encouragement = "Đừng nản nhé! Shadowing tiếng Nhật cần lặp lại nhiều lần — thử giảm tốc độ nghe xuống 0.75x rồi đọc lại."
        elif asr.available and asr.characterSimilarity is not None:
            summary = (
                f"Đã nhận diện lời nói tiếng Nhật (độ khớp văn bản {asr.characterSimilarity:.1f}%). "
                "Một số chỉ số phát âm chi tiết không khả dụng cho lượt ghi âm này."
            )
            encouragement = "Hãy tiếp tục luyện tập đều đặn mỗi ngày để cải thiện phản xạ phát âm nhé!"
        else:
            summary = "Đã hoàn tất phân tích một phần bản ghi âm. Vui lòng xem chi tiết và cảnh báo bên dưới."
            encouragement = "Hãy kiểm tra micro và thử ghi âm lại một lượt rõ hơn nhé!"

        return FeedbackSection(
            source="TEMPLATE",
            summary=summary,
            explanations=explanations,
            practiceSuggestions=list(dict.fromkeys(suggestions))[:5],
            encouragement=encouragement,
        )

    def _try_qwen_feedback(
        self,
        reference_text: str,
        asr: AsrSection,
        scores: ScoreBreakdown,
        pronunciation: PronunciationSection,
        intonation: IntonationSection,
        jlpt_level: Optional[str],
        fallback: FeedbackSection,
    ) -> FeedbackSection:
        """Optional local Qwen3-4B feedback enhancer (strictly grounded on structured metrics)."""
        try:
            with self._load_lock:
                if self._model is None:
                    from transformers import AutoModelForCausalLM, AutoTokenizer

                    logger.info("Loading optional feedback LLM %s", self.settings.shadowing_feedback_model)
                    self._tokenizer = AutoTokenizer.from_pretrained(self.settings.shadowing_feedback_model)
                    self._model = AutoModelForCausalLM.from_pretrained(
                        self.settings.shadowing_feedback_model,
                        dtype=self.device_manager.preferred_dtype,
                    )

            structured_input = {
                "referenceText": reference_text,
                "recognizedText": asr.recognizedText,
                "jlptLevel": jlpt_level or "N5-N3",
                "scores": scores.model_dump(),
                "pronunciationErrors": [e.model_dump() for e in pronunciation.errors[:5]],
                "intonation": {
                    "experimental": True,
                    "f0Available": intonation.f0Available,
                    "score": intonation.score,
                    "finalPitchMovement": intonation.finalPitchMovement,
                    "expectedFinalMovement": intonation.expectedFinalMovement,
                    "pauseCount": len(intonation.pauseAnalysis),
                },
            }

            system_prompt = (
                "Bạn là trợ lý hướng dẫn phát âm tiếng Nhật cho người Việt. "
                "CHỈ giải thích dựa trên dữ liệu JSON đo đạc được cung cấp. "
                "KHÔNG tự bịa thêm điểm số, KHÔNG khẳng định bạn trực tiếp nghe audio. "
                "Trả về JSON ngắn gọn: {\"summary\": \"...\", \"encouragement\": \"...\", \"practiceSuggestions\": [\"...\"]}."
            )
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(structured_input, ensure_ascii=False)},
            ]
            prompt = self._tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True, enable_thinking=False
            )

            class _Wrapper:
                def __init__(self, m):
                    self.model = m

            with self.device_manager.acquire_model(_Wrapper(self._model), "Qwen3-4B") as dev:
                inputs = self._tokenizer(prompt, return_tensors="pt").to(dev)
                out_ids = self._model.generate(**inputs, max_new_tokens=256, do_sample=False)
                gen_text = self._tokenizer.decode(out_ids[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True)

            start = gen_text.find("{")
            end = gen_text.rfind("}")
            if start >= 0 and end > start:
                parsed = json.loads(gen_text[start : end + 1])
                return FeedbackSection(
                    source="QWEN3_4B",
                    summary=str(parsed.get("summary") or fallback.summary),
                    explanations=fallback.explanations,
                    practiceSuggestions=[str(x) for x in (parsed.get("practiceSuggestions") or fallback.practiceSuggestions)][:5],
                    encouragement=str(parsed.get("encouragement") or fallback.encouragement),
                )
        except Exception as exc:
            self._last_error = f"{type(exc).__name__}: {exc}"
            logger.warning("Optional Qwen3-4B feedback unavailable (%s); using deterministic templates", self._last_error)

        return fallback

    def generate(
        self,
        reference_text: str,
        asr: AsrSection,
        scores: ScoreBreakdown,
        pronunciation: PronunciationSection,
        intonation: IntonationSection,
        jlpt_level: Optional[str] = None,
    ) -> FeedbackSection:
        deterministic = self._build_deterministic_feedback(
            reference_text=reference_text,
            asr=asr,
            scores=scores,
            pronunciation=pronunciation,
            intonation=intonation,
            jlpt_level=jlpt_level,
        )
        if self.settings.shadowing_feedback_model_enabled:
            return self._try_qwen_feedback(
                reference_text=reference_text,
                asr=asr,
                scores=scores,
                pronunciation=pronunciation,
                intonation=intonation,
                jlpt_level=jlpt_level,
                fallback=deterministic,
            )
        return deterministic
