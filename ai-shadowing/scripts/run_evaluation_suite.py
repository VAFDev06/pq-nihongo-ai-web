"""Phase 6 comprehensive Japanese Shadowing evaluation suite.

Evaluates the complete local AI pipeline (Qwen3-ASR-0.6B, Qwen3-ForcedAligner-0.6B,
hatsuon, experimental F0 intonation, and deterministic Vietnamese feedback) across all
categories required by Section 14:
- Hiragana, Katakana, Kanji
- Long vowels, small っ (sokuon), moraic ん, similar Japanese sounds
- Short & long sentences
- Questions vs statements
- Different speaking speeds & pause patterns
- Pitch accent pairs
- Cross-speaker reference comparison (male vs female)
- Learner-like perturbed audio (particle omission, short-vowel substitution, long pause, pitch/speed shift)
- Edge cases (silence, too short)

NOTE: Every sample is transparently labeled with its exact provenance (synthetic native-style TTS
or acoustically perturbed learner simulation). Synthetic scores are never misrepresented as human
learner calibration data.
"""
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("HATSUON_MODEL_DIR", str(ROOT / ".cache" / "hatsuon"))

from fastapi.testclient import TestClient
from app.main import app

AUDIO_DIR = ROOT / ".cache" / "test_audio"
OUT_JSON = ROOT / ".cache" / "evaluation_suite_results.json"

CASES = [
    # (id, category, reference_text, learner_wav, ref_wav, jlpt, provenance)
    ("01", "Hiragana", "おはよう。きょうはいいてんきですね。", "01_hiragana.wav", None, "N5", "Synthetic native-style TTS (ja-JP-NanamiNeural)"),
    ("02", "Katakana", "コーヒーとサンドイッチをください。", "02_katakana.wav", None, "N5", "Synthetic native-style TTS (ja-JP-NanamiNeural)"),
    ("03", "Kanji (with cross-speaker ref)", "私は毎日日本語を勉強します。", "03_kanji.wav", "03_kanji_ref_male.wav", "N5", "Synthetic female learner vs male reference TTS"),
    ("04", "Long vowels (長音)", "おばあさんは東京の高校の先生です。", "04_long_vowel.wav", None, "N4", "Synthetic native-style TTS (ja-JP-KeitaNeural)"),
    ("05", "Small っ (促音)", "きってを買って、ちょっと待ってください。", "05_sokuon_tsu.wav", None, "N4", "Synthetic native-style TTS (ja-JP-NanamiNeural)"),
    ("06", "Moraic ん (撥音)", "にほんごのしんぶんをよんでいます。", "06_moraic_n.wav", None, "N5", "Synthetic native-style TTS (ja-JP-KeitaNeural)"),
    ("07", "Similar sounds (りょ/りょう)", "りょこうでりょうりをたべました。", "07_similar_sounds.wav", None, "N4", "Synthetic native-style TTS (ja-JP-NanamiNeural)"),
    ("08", "Short sentence", "ありがとうございます。", "08_short_sentence.wav", None, "N5", "Synthetic native-style TTS (ja-JP-NanamiNeural)"),
    ("09", "Long sentence", "昨日の夜、友達と一緒に駅前の新しいレストランで美味しいラーメンを食べました。", "09_long_sentence.wav", None, "N3", "Synthetic native-style TTS (ja-JP-KeitaNeural)"),
    ("10", "Question (rising intonation)", "あしたは学校へ行きますか？", "10_question.wav", None, "N5", "Synthetic native-style TTS (ja-JP-NanamiNeural)"),
    ("11", "Statement (falling intonation)", "あしたは学校へ行きます。", "11_statement.wav", None, "N5", "Synthetic native-style TTS (ja-JP-NanamiNeural)"),
    ("12", "Slow speed (-30%)", "東京に行きます。", "12_slow_speed.wav", None, "N5", "Synthetic slow TTS (-30%)"),
    ("13", "Fast speed (+25%)", "東京に行きます。", "13_fast_speed.wav", None, "N5", "Synthetic fast TTS (+25%)"),
    ("14", "Pitch accent pair (橋 vs 箸)", "橋を渡って、箸で食べます。", "14_pitch_pair_hashi.wav", None, "N3", "Synthetic native-style TTS (ja-JP-KeitaNeural)"),
    ("15", "Pitch accent pair (雨 vs 飴)", "雨が降る日に飴を食べます。", "15_pitch_pair_ame.wav", None, "N4", "Synthetic native-style TTS (ja-JP-NanamiNeural)"),
    ("16", "Learner-like: particle omission (を)", "私は毎日日本語を勉強します。", "16_learner_omission.wav", "03_kanji_ref_male.wav", "N5", "Simulated learner error (omitted を, -15% speed)"),
    ("17", "Learner-like: short vowel error (おばさん vs おばあさん)", "おばあさんは東京の高校の先生です。", "17_learner_short_vowel.wav", "04_long_vowel.wav", "N4", "Simulated learner error (shortened ああ -> あ)"),
    ("18", "Learner-like: excessive mid-sentence pause (+0.7s)", "私は毎日日本語を勉強します。", "18_learner_long_pause.wav", "03_kanji_ref_male.wav", "N5", "Perturbed audio (+0.7s inserted pause)"),
    ("19", "Learner-like: +4st pitch shift & 0.82x slower vs ref", "私は毎日日本語を勉強します。", "19_learner_pitch_speed_diff.wav", "03_kanji_ref_male.wav", "N5", "Perturbed audio (+4 semitones, 0.82x speed)"),
    ("20", "Learner-like: flat/falling statement for question", "あしたは学校へ行きますか？", "11_statement.wav", "10_question.wav", "N5", "Mismatch test (statement audio vs question reference)"),
]

EDGE_CASES = [
    ("E1", "Silence (2.0s)", "こんにちは。", "20_edge_silence.wav"),
    ("E2", "Too short (0.1s)", "こんにちは。", "21_edge_too_short.wav"),
]


def main() -> int:
    client = TestClient(app)
    health = client.get("/health").json()
    print("Health:", json.dumps(health, ensure_ascii=False))

    results = []
    t_all = time.perf_counter()

    for cid, cat, ref_text, learner_file, ref_file, jlpt, prov in CASES:
        lp = AUDIO_DIR / learner_file
        if not lp.exists():
            print(f"[SKIP] Missing {lp}")
            continue
        files = {"audio": (learner_file, lp.read_bytes(), "audio/wav")}
        if ref_file and (AUDIO_DIR / ref_file).exists():
            files["referenceAudio"] = (ref_file, (AUDIO_DIR / ref_file).read_bytes(), "audio/wav")

        t0 = time.perf_counter()
        resp = client.post(
            "/shadowing/evaluate",
            files=files,
            data={"referenceText": ref_text, "jlptLevel": jlpt},
        )
        dt = round(time.perf_counter() - t0, 2)
        body = resp.json()
        scores = body.get("scores", {})
        inton = body.get("intonation", {})
        pron = body.get("pronunciation", {})
        align = body.get("alignment", {})

        row = {
            "id": cid,
            "category": cat,
            "jlpt": jlpt,
            "provenance": prov,
            "referenceText": ref_text,
            "learnerAudio": learner_file,
            "referenceAudio": ref_file,
            "httpStatus": resp.status_code,
            "status": body.get("status"),
            "recognizedText": body.get("recognizedText"),
            "charSimilarity": body.get("asr", {}).get("characterSimilarity"),
            "scores": scores,
            "confidence": body.get("confidence"),
            "alignmentSegments": len(align.get("segments", [])),
            "pronunciationErrorCount": len(pron.get("errors", [])),
            "pronunciationErrors": [e.get("detail") for e in pron.get("errors", [])[:4]],
            "specialMoraSummary": pron.get("specialMoraSummary"),
            "intonationSummary": {
                "experimental": inton.get("experimental"),
                "f0Available": inton.get("f0Available"),
                "reliability": inton.get("reliability"),
                "score": inton.get("score"),
                "finalPitchMovement": inton.get("finalPitchMovement"),
                "expectedFinalMovement": inton.get("expectedFinalMovement"),
                "finalPitchMatch": inton.get("finalPitchMatch"),
                "pauseCount": len(inton.get("pauseAnalysis", [])),
                "referenceComparison": inton.get("referenceComparison"),
            },
            "warnings": body.get("warnings", []),
            "elapsedSec": dt,
        }
        results.append(row)
        print(
            f"[{cid}] {cat:45s} | HTTP {resp.status_code} | ASR={row['recognizedText']} | "
            f"overall={scores.get('overall')} acc={scores.get('accuracy')} pitch={scores.get('pitchAccent')} "
            f"inton={scores.get('intonation')} ({inton.get('finalPitchMovement')}) conf={row['confidence']} ({dt}s)"
        )

    edge_results = []
    for eid, cat, ref_text, fname in EDGE_CASES:
        lp = AUDIO_DIR / fname
        resp = client.post(
            "/shadowing/evaluate",
            files={"audio": (fname, lp.read_bytes(), "audio/wav")},
            data={"referenceText": ref_text},
        )
        erow = {
            "id": eid,
            "category": cat,
            "audio": fname,
            "httpStatus": resp.status_code,
            "response": resp.json(),
        }
        edge_results.append(erow)
        print(f"[{eid}] {cat:30s} | HTTP {resp.status_code} | {erow['response']}")

    payload = {
        "health": health,
        "totalElapsedSec": round(time.perf_counter() - t_all, 2),
        "cases": results,
        "edgeCases": edge_results,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved full evaluation report JSON to {OUT_JSON} ({payload['totalElapsedSec']}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
