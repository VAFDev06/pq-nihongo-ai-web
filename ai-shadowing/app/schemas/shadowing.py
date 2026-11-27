"""Pydantic schemas for the Shadowing AI Model Server API."""
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ScoreBreakdown(BaseModel):
    overall: Optional[float] = None
    accuracy: Optional[float] = None
    completeness: Optional[float] = None
    pitchAccent: Optional[float] = None
    intonation: Optional[float] = None
    timing: Optional[float] = None


class MoraEvaluation(BaseModel):
    kana: str
    wordSurface: Optional[str] = None
    phonemes: List[str] = Field(default_factory=list)
    startTime: Optional[float] = None
    endTime: Optional[float] = None
    score: Optional[float] = None
    status: str
    substitutedBy: Optional[str] = None
    durationStatus: Optional[str] = None
    expectedPitchLevel: Optional[str] = None
    observedSemitone: Optional[float] = None
    pitchStatus: Optional[str] = None
    devoicedExpected: bool = False
    isSpecialMora: bool = False
    specialMoraType: Optional[str] = None  # SOKUON | MORAIC_N | LONG_VOWEL


class WordPronunciationEvaluation(BaseModel):
    surface: str
    reading: str = ""
    score: Optional[float] = None
    accentType: Optional[int] = None
    accentOutcome: str = "unknown"
    startTime: Optional[float] = None
    endTime: Optional[float] = None
    morae: List[MoraEvaluation] = Field(default_factory=list)


class PronunciationErrorItem(BaseModel):
    type: str  # MORA_MISPRONOUNCED | MORA_DELETED | SPECIAL_MORA_DURATION | PITCH_ACCENT
    word: str
    reading: Optional[str] = None
    mora: Optional[str] = None
    expected: Optional[str] = None
    observed: Optional[str] = None
    severity: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    detail: str


class InsertionItem(BaseModel):
    startTime: float
    endTime: float
    content: Optional[str] = None


class SpecialMoraSummary(BaseModel):
    sokuonTotal: int = 0
    sokuonIssues: int = 0
    moraicNTotal: int = 0
    moraicNIssues: int = 0
    longVowelTotal: int = 0
    longVowelIssues: int = 0


class PronunciationSection(BaseModel):
    available: bool = False
    engine: str = "hatsuon"
    alphaDisclaimer: str = (
        "Đánh giá phát âm mora và trọng âm Tokyo dựa trên hatsuon (phiên bản alpha, "
        "hiệu chuẩn trên dữ liệu người bản xứ — chỉ dùng làm gợi ý luyện tập, không phải điểm thi chính thức)."
    )
    moraResults: List[MoraEvaluation] = Field(default_factory=list)
    wordResults: List[WordPronunciationEvaluation] = Field(default_factory=list)
    specialMoraSummary: SpecialMoraSummary = Field(default_factory=SpecialMoraSummary)
    errors: List[PronunciationErrorItem] = Field(default_factory=list)
    insertions: List[InsertionItem] = Field(default_factory=list)


class PitchPoint(BaseModel):
    timeSec: float
    f0Hz: Optional[float] = None
    semitone: Optional[float] = None
    voiced: bool = False


class PauseSegment(BaseModel):
    startSec: float
    endSec: float
    durationSec: float
    severity: Literal["NORMAL", "LONG", "EXCESSIVE"] = "NORMAL"


class ReferenceIntonationComparison(BaseModel):
    dtwMaeSemitones: Optional[float] = None
    contourCorrelation: Optional[float] = None
    durationRatio: Optional[float] = None
    pauseCountDelta: Optional[int] = None
    referenceMedianF0Hz: Optional[float] = None
    referencePitchRangeSemitones: Optional[float] = None


class IntonationSection(BaseModel):
    experimental: bool = True
    f0Available: bool = False
    referenceComparisonAvailable: bool = False
    reliability: Literal["HIGH", "MEDIUM", "LOW", "UNRELIABLE"] = "UNRELIABLE"
    confidence: Optional[float] = None
    score: Optional[float] = None
    medianF0Hz: Optional[float] = None
    pitchRangeSemitones: Optional[float] = None
    pitchStdSemitones: Optional[float] = None
    voicedRatio: Optional[float] = None
    finalPitchMovement: Optional[str] = None  # RISING | FALLING | FLAT | UNKNOWN
    expectedFinalMovement: Optional[str] = None  # RISING | FALLING_OR_FLAT
    finalPitchMatch: Optional[bool] = None
    speakingDurationSec: Optional[float] = None
    articulationRatio: Optional[float] = None
    pitchContour: List[PitchPoint] = Field(default_factory=list)
    pauseAnalysis: List[PauseSegment] = Field(default_factory=list)
    referenceComparison: Optional[ReferenceIntonationComparison] = None
    feedback: List[str] = Field(default_factory=list)


class AlignmentSegment(BaseModel):
    unit: str
    startTime: float
    endTime: float
    duration: float


class AlignmentSection(BaseModel):
    available: bool = False
    engine: str = "Qwen/Qwen3-ForcedAligner-0.6B"
    note: str = "Mốc thời gian căn chỉnh chữ-âm thanh dùng để phân tích nhịp độ và đồng bộ phản hồi."
    segments: List[AlignmentSegment] = Field(default_factory=list)


class AsrSection(BaseModel):
    available: bool = False
    engine: str = "Qwen/Qwen3-ASR-0.6B"
    language: str = "ja"
    recognizedText: str = ""
    characterSimilarity: Optional[float] = None
    uncertaintyNote: Optional[str] = None


class FeedbackExplanationItem(BaseModel):
    category: str  # ASR_DIFF | MORA | SPECIAL_MORA | PITCH_ACCENT | INTONATION | TIMING
    incorrectFragment: Optional[str] = None
    correctFragment: Optional[str] = None
    reason: str
    suggestion: str


class FeedbackSection(BaseModel):
    source: Literal["TEMPLATE", "QWEN3_4B"] = "TEMPLATE"
    summary: str = ""
    explanations: List[FeedbackExplanationItem] = Field(default_factory=list)
    practiceSuggestions: List[str] = Field(default_factory=list)
    encouragement: str = ""


class AudioQualityInfo(BaseModel):
    durationSec: float
    sampleRate: int
    originalSampleRate: int
    originalChannels: int
    fileSizeBytes: int
    rmsDb: float
    peakAmplitude: float
    clippingRatio: float
    estimatedSnrDb: Optional[float] = None
    warnings: List[str] = Field(default_factory=list)


class EvaluationMetadata(BaseModel):
    audioDurationSec: Optional[float] = None
    sampleRate: Optional[int] = None
    deviceUsed: str = "cpu"
    processingTimeMs: int = 0
    modelsUsed: List[str] = Field(default_factory=list)
    audioQuality: Optional[AudioQualityInfo] = None


class ShadowingEvaluationResponse(BaseModel):
    referenceText: str
    recognizedText: str = ""
    status: Literal["COMPLETED", "PARTIAL", "FAILED"] = "COMPLETED"
    scores: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    pronunciation: PronunciationSection = Field(default_factory=PronunciationSection)
    intonation: IntonationSection = Field(default_factory=IntonationSection)
    alignment: AlignmentSection = Field(default_factory=AlignmentSection)
    asr: AsrSection = Field(default_factory=AsrSection)
    feedback: FeedbackSection = Field(default_factory=FeedbackSection)
    warnings: List[str] = Field(default_factory=list)
    confidence: Optional[float] = None
    metadata: EvaluationMetadata = Field(default_factory=EvaluationMetadata)


class HealthComponentStatus(BaseModel):
    enabled: bool
    loaded: bool
    ready: bool
    model: Optional[str] = None
    device: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: Literal["UP", "DEGRADED"]
    device: str
    cudaAvailable: bool
    gpuName: Optional[str] = None
    gpuVramMb: Optional[int] = None
    lowVramMode: bool
    components: Dict[str, HealthComponentStatus]
    metadata: Dict[str, Any] = Field(default_factory=dict)
