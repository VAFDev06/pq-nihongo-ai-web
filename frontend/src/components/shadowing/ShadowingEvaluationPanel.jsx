import React, { useState } from 'react';
import {
  Award,
  AlertTriangle,
  Activity,
  Clock,
  Sparkles,
  CheckCircle2,
  Info,
  Volume2,
  MessageSquareText,
  ChevronDown,
  ChevronUp,
  Cpu,
} from 'lucide-react';

const formatScore = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Math.round(Number(value))}%`;
};

const scoreToneClass = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'text-secondary';
  }
  const n = Number(value);
  if (n >= 85) return 'text-success';
  if (n >= 65) return 'text-warning';
  return 'text-danger';
};

const confidenceBadge = (confidence) => {
  if (confidence === null || confidence === undefined || Number.isNaN(Number(confidence))) {
    return { label: 'Chưa xác định độ tin cậy', cls: 'bg-secondary bg-opacity-10 text-secondary border-secondary' };
  }
  const pct = Math.round(Number(confidence) * 100);
  if (pct >= 75) {
    return { label: `Độ tin cậy cao (${pct}%)`, cls: 'bg-success bg-opacity-10 text-success border-success' };
  }
  if (pct >= 50) {
    return { label: `Độ tin cậy trung bình (${pct}%)`, cls: 'bg-warning bg-opacity-10 text-dark border-warning' };
  }
  return { label: `Độ tin cậy thấp (${pct}%)`, cls: 'bg-danger bg-opacity-10 text-danger border-danger' };
};

const ACCENT_LABEL_VI = {
  correct: { text: 'Đúng chuẩn Tokyo', cls: 'bg-success bg-opacity-10 text-success border-success' },
  missing_fall: { text: 'Thiếu điểm hạ giọng', cls: 'bg-danger bg-opacity-10 text-danger border-danger' },
  flat_for_accented: { text: 'Đọc phẳng (thiếu hạ giọng)', cls: 'bg-warning bg-opacity-10 text-dark border-warning' },
  wrong_nucleus: { text: 'Sai vị trí hạ giọng', cls: 'bg-warning bg-opacity-10 text-dark border-warning' },
  early_fall: { text: 'Hạ giọng sớm', cls: 'bg-warning bg-opacity-10 text-dark border-warning' },
  late_fall: { text: 'Hạ giọng muộn', cls: 'bg-warning bg-opacity-10 text-dark border-warning' },
  fall_for_unaccented: { text: 'Hạ giọng ở từ Heiban', cls: 'bg-info bg-opacity-10 text-dark border-info' },
  unreliable: { text: 'Chưa đủ tin cậy', cls: 'bg-light text-muted border' },
  unknown: { text: 'Không xác định', cls: 'bg-light text-muted border' },
};

const FINAL_MOVEMENT_VI = {
  RISING: 'Lên giọng ↗',
  FALLING: 'Hạ giọng ↘',
  FLAT: 'Ngang / ổn định →',
  UNKNOWN: 'Không rõ',
};

/**
 * Compact SVG plot for speaker-normalized F0 pitch contour (in semitones relative to speaker median).
 */
const PitchContourChart = ({ contour = [] }) => {
  const voiced = contour.filter((p) => p.voiced && p.semitone !== null && p.semitone !== undefined);
  if (voiced.length < 3) return null;

  const width = 520;
  const height = 110;
  const padX = 28;
  const padY = 14;

  const maxTime = Math.max(...contour.map((p) => Number(p.timeSec || 0)), 0.5);
  const stValues = voiced.map((p) => Number(p.semitone));
  const minSt = Math.min(-6, Math.floor(Math.min(...stValues) - 1));
  const maxSt = Math.max(6, Math.ceil(Math.max(...stValues) + 1));
  const stSpan = Math.max(1, maxSt - minSt);

  const mapX = (t) => padX + (Number(t) / maxTime) * (width - padX * 2);
  const mapY = (st) => height - padY - ((Number(st) - minSt) / stSpan) * (height - padY * 2);

  // Build polyline segments split on unvoiced gaps
  const polylines = [];
  let current = [];
  contour.forEach((pt) => {
    if (pt.voiced && pt.semitone !== null && pt.semitone !== undefined) {
      current.push(`${mapX(pt.timeSec).toFixed(1)},${mapY(pt.semitone).toFixed(1)}`);
    } else if (current.length > 0) {
      polylines.push(current);
      current = [];
    }
  });
  if (current.length > 0) polylines.push(current);

  const zeroY = mapY(0);

  return (
    <div className="bg-white rounded-3 border p-2.5">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span className="small fw-semibold text-secondary">
          Đường cao độ F0 chuẩn hóa (bán cung so với F0 trung vị của bạn)
        </span>
        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
          0 st = giọng trung bình · 0s → {maxTime.toFixed(1)}s
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-100" style={{ maxHeight: '115px' }}>
        <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke="#cbd5e1" strokeDasharray="4 3" strokeWidth="1" />
        <text x={4} y={zeroY + 3} fontSize="9" fill="#64748b">0st</text>
        <text x={4} y={padY + 4} fontSize="9" fill="#64748b">+{maxSt}</text>
        <text x={4} y={height - padY} fontSize="9" fill="#64748b">{minSt}</text>
        {polylines.map((pts, idx) =>
          pts.length === 1 ? (
            <circle
              key={idx}
              cx={pts[0].split(',')[0]}
              cy={pts[0].split(',')[1]}
              r="2.5"
              fill="#0d6efd"
            />
          ) : (
            <polyline
              key={idx}
              fill="none"
              stroke="#0d6efd"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pts.join(' ')}
            />
          )
        )}
      </svg>
    </div>
  );
};

export const ShadowingEvaluationPanel = ({
  attemptResult,
  expectedTextJa,
  recordedAudioUrl = null,
  title = 'Kết quả đánh giá phát âm',
  showComparisonText = true,
  onToggleComparisonText = null,
  compact = false,
}) => {
  const [showAlignment, setShowAlignment] = useState(false);
  const [showMoraDetails, setShowMoraDetails] = useState(!compact);

  if (!attemptResult) return null;

  const evalData = attemptResult.evaluation || null;
  const scores = evalData?.scores || null;
  const pronunciation = evalData?.pronunciation || null;
  const intonation = evalData?.intonation || null;
  const alignment = evalData?.alignment || null;
  const feedback = evalData?.feedback || null;
  const warnings = Array.isArray(evalData?.warnings) ? evalData.warnings : [];
  const wordDiff = attemptResult.wordDiff || evalData?.wordDiff || attemptResult.tokenAlignments || [];

  const refText = expectedTextJa || evalData?.referenceText || '';
  const recognizedText = attemptResult.recognizedText || evalData?.recognizedText || '';
  const primaryScore =
    scores && scores.overall !== null && scores.overall !== undefined
      ? scores.overall
      : attemptResult.accuracy ?? attemptResult.accuracyScore ?? null;
  const confInfo = evalData ? confidenceBadge(evalData.confidence) : null;

  return (
    <div className={`card pq-card ${compact ? 'p-3' : 'p-4'} rounded-4 shadow-sm border text-start d-flex flex-column gap-3`}>
      {/* 1. Header: Overall evaluation + confidence + mode */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom pb-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <Award size={24} className="text-warning flex-shrink-0" />
          <div>
            <h6 className="fw-bold mb-0 text-dark">{title}</h6>
            <div className="d-flex flex-wrap align-items-center gap-1.5 mt-1">
              {evalData ? (
                <>
                  <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 d-inline-flex align-items-center gap-1">
                    <Cpu size={11} />
                    <span>Local AI Shadowing</span>
                  </span>
                  <span className={`badge border ${confInfo.cls}`}>{confInfo.label}</span>
                  {evalData.status === 'PARTIAL' && (
                    <span className="badge bg-warning text-dark">Kết quả một phần (PARTIAL)</span>
                  )}
                </>
              ) : (
                <span className="badge bg-light text-secondary border">Đối chiếu văn bản Kuromoji</span>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <div className="text-end">
            <div className={`fs-3 fw-bold lh-1 ${scoreToneClass(primaryScore)}`}>
              {primaryScore !== null && primaryScore !== undefined ? `${Math.round(Number(primaryScore))}%` : '—'}
            </div>
            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
              {scores?.overall !== null && scores?.overall !== undefined ? 'Tổng quan phát âm' : 'Độ khớp từ'}
            </div>
          </div>
          {typeof onToggleComparisonText === 'function' && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onToggleComparisonText}
            >
              {showComparisonText ? 'Ẩn đối chiếu' : 'Hiện đối chiếu'}
            </button>
          )}
        </div>
      </div>

      {/* Playback of user's own recording */}
      {recordedAudioUrl && (
        <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2 bg-light rounded-3 border">
          <Volume2 size={16} className="text-primary flex-shrink-0" />
          <span className="small fw-semibold text-secondary">Nghe lại giọng bạn vừa ghi âm:</span>
          <audio controls src={recordedAudioUrl} style={{ height: '32px', maxWidth: '100%' }} className="ms-auto" />
        </div>
      )}

      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="alert alert-warning py-2.5 px-3 mb-0 rounded-3 small d-flex gap-2 align-items-start">
          <AlertTriangle size={17} className="flex-shrink-0 mt-0.5 text-warning-emphasis" />
          <div className="d-flex flex-column gap-1">
            <strong className="text-dark">Lưu ý về chất lượng / phạm vi đánh giá:</strong>
            <ul className="mb-0 ps-3">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 2 & 3. Reference vs Recognized + Kuromoji Word Diff */}
      <div className="row g-2">
        <div className="col-12 col-md-6">
          <div className="p-2.5 bg-light rounded-3 border h-100">
            <div className="text-muted small fw-semibold mb-1">Câu gốc:</div>
            <div className="font-jp fw-bold text-dark">{refText}</div>
            {evalData?.referenceReading && (
              <div className="font-jp text-primary mt-0.5" style={{ fontSize: '0.82rem' }}>
                {evalData.referenceReading}
              </div>
            )}
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="p-2.5 bg-primary bg-opacity-10 rounded-3 border border-primary border-opacity-25 h-100">
            <div className="text-primary small fw-semibold mb-1">
              {evalData?.asr?.available ? 'ASR cục bộ nhận diện (Qwen3-ASR):' : 'Bạn đã nói:'}
            </div>
            <div className="font-jp fw-bold text-dark">
              {recognizedText || <span className="text-muted fst-italic">(Không nhận diện được lời nói)</span>}
            </div>
            {scores?.kuromojiTokenAccuracy !== null && scores?.kuromojiTokenAccuracy !== undefined && (
              <div className="text-muted mt-0.5" style={{ fontSize: '0.76rem' }}>
                Khớp từ Kuromoji: <strong>{Math.round(scores.kuromojiTokenAccuracy)}%</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {showComparisonText && wordDiff.length > 0 && (
        <div className="p-3.5 rounded-4 border font-jp" style={{ background: '#1a1d24', color: '#ffffff' }}>
          <div className="small text-white-50 mb-2">Đối chiếu từng từ (Kuromoji):</div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {wordDiff.map((tok, idx) => {
              const text = tok.text || tok.expectedSurface || tok.originalWord || tok.heard || '';
              const color =
                tok.status === 'CORRECT'
                  ? { bg: 'rgba(16, 185, 129, 0.15)', bd: '#10b981', fg: '#34d399', icon: '✓' }
                  : tok.status === 'WRONG'
                  ? { bg: 'rgba(239, 68, 68, 0.15)', bd: '#ef4444', fg: '#f87171', icon: '✗' }
                  : tok.status === 'MISSING'
                  ? { bg: 'rgba(245, 158, 11, 0.15)', bd: '#f59e0b', fg: '#fbbf24', icon: '⚠' }
                  : { bg: 'rgba(56, 189, 248, 0.15)', bd: '#38bdf8', fg: '#7dd3fc', icon: '+' };
              return (
                <div
                  key={idx}
                  className="d-inline-flex flex-column align-items-center px-2.5 py-1.5 rounded-3 fw-bold"
                  style={{
                    background: color.bg,
                    border: `1.5px solid ${color.bd}`,
                    color: color.fg,
                    fontSize: '1rem',
                  }}
                >
                  <div className="d-flex align-items-center gap-1">
                    <span>{text}</span>
                    <span style={{ fontSize: '0.78rem' }}>{color.icon}</span>
                  </div>
                  {tok.heard && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 'normal', opacity: 0.85 }}>
                      nghe: {tok.heard}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Detailed Score Grid (Local AI — never fabricates null metrics) */}
      {scores && (
        <div className="row g-2">
          {[
            { label: 'Chính xác Mora', val: scores.accuracy, sub: 'hatsuon' },
            { label: 'Độ đầy đủ', val: scores.completeness, sub: 'hatsuon' },
            { label: 'Trọng âm Tokyo', val: scores.pitchAccent, sub: 'Word Pitch (Alpha)' },
            { label: 'Ngữ điệu câu F0', val: scores.intonation, sub: 'Thử nghiệm (Experimental)' },
            { label: 'Nhịp độ & Trường âm', val: scores.timing, sub: 'hatsuon timing' },
          ].map((item, idx) => (
            <div key={idx} className="col-6 col-md-4 col-lg">
              <div className="p-2.5 bg-light rounded-3 border text-center h-100">
                <div className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>
                  {item.label}
                </div>
                <div className={`fs-5 fw-bold my-0.5 ${scoreToneClass(item.val)}`}>
                  {formatScore(item.val)}
                </div>
                <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                  {item.val === null || item.val === undefined ? 'Chưa khả dụng' : item.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5 & 6. Mora-level & Special Mora + Tokyo Pitch Accent */}
      {pronunciation && (pronunciation.available || (pronunciation.wordResults && pronunciation.wordResults.length > 0)) && (
        <div className="p-3 bg-light rounded-3 border">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <div className="fw-bold text-dark small d-flex align-items-center gap-1.5">
              <CheckCircle2 size={16} className="text-primary" />
              <span>Phân tích Mora, Mora đặc biệt (っ / ん / trường âm) & Trọng âm Tokyo</span>
            </div>
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none d-inline-flex align-items-center gap-1"
              onClick={() => setShowMoraDetails((v) => !v)}
            >
              <span>{showMoraDetails ? 'Thu gọn' : 'Xem chi tiết'}</span>
              {showMoraDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {pronunciation.specialMoraSummary && (
            <div className="d-flex flex-wrap gap-2 mb-2 small">
              <span className="badge bg-white text-dark border">
                Âm ngắt 「っ」: {pronunciation.specialMoraSummary.sokuonTotal - pronunciation.specialMoraSummary.sokuonIssues}/
                {pronunciation.specialMoraSummary.sokuonTotal} đạt
              </span>
              <span className="badge bg-white text-dark border">
                Âm mũi 「ん」: {pronunciation.specialMoraSummary.moraicNTotal - pronunciation.specialMoraSummary.moraicNIssues}/
                {pronunciation.specialMoraSummary.moraicNTotal} đạt
              </span>
              <span className="badge bg-white text-dark border">
                Trường âm 「ー」: {pronunciation.specialMoraSummary.longVowelTotal - pronunciation.specialMoraSummary.longVowelIssues}/
                {pronunciation.specialMoraSummary.longVowelTotal} đạt
              </span>
            </div>
          )}

          {showMoraDetails && (
            <div className="d-flex flex-column gap-2 mt-2">
              <div className="d-flex flex-wrap gap-2">
                {(pronunciation.wordResults || []).map((w, wIdx) => {
                  const accentMeta = ACCENT_LABEL_VI[w.accentOutcome] || ACCENT_LABEL_VI.unknown;
                  return (
                    <div key={wIdx} className="p-2 bg-white rounded-3 border" style={{ minWidth: '120px' }}>
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                        <span className="font-jp fw-bold text-dark">{w.surface}</span>
                        <span className={`small fw-bold ${scoreToneClass(w.score)}`}>{formatScore(w.score)}</span>
                      </div>
                      <div className="d-flex flex-wrap gap-1 mb-1.5">
                        {(w.morae || []).map((m, mIdx) => {
                          const isBad = m.status !== 'correct';
                          const durIssue = m.durationStatus && m.durationStatus !== 'ok';
                          const chipCls = isBad
                            ? 'bg-danger text-white'
                            : durIssue
                            ? 'bg-warning text-dark'
                            : m.specialMoraType
                            ? 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25'
                            : 'bg-success bg-opacity-10 text-success border border-success border-opacity-25';
                          return (
                            <span
                              key={mIdx}
                              className={`badge font-jp ${chipCls}`}
                              title={`Mora ${m.kana} | ${m.status} | điểm ${m.score ?? '—'}${m.durationStatus ? ` | độ dài: ${m.durationStatus}` : ''}`}
                            >
                              {m.kana}
                            </span>
                          );
                        })}
                      </div>
                      {w.accentOutcome && w.accentOutcome !== 'unknown' && (
                        <span className={`badge border ${accentMeta.cls}`} style={{ fontSize: '0.68rem' }}>
                          {accentMeta.text}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {pronunciation.errors && pronunciation.errors.length > 0 && (
                <div className="bg-white rounded-3 border p-2.5 small">
                  <div className="fw-semibold text-danger mb-1">Điểm cần chú ý (Mora & Trọng âm):</div>
                  <ul className="mb-0 ps-3">
                    {pronunciation.errors.slice(0, 6).map((err, eIdx) => (
                      <li key={eIdx}>{err.detail}</li>
                    ))}
                  </ul>
                </div>
              )}

              {pronunciation.alphaDisclaimer && (
                <div className="text-muted d-flex align-items-start gap-1" style={{ fontSize: '0.73rem' }}>
                  <Info size={13} className="flex-shrink-0 mt-0.5" />
                  <span>{pronunciation.alphaDisclaimer}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. Experimental Sentence-Level Intonation (F0) & Pause Analysis */}
      {intonation && (
        <div className="p-3 bg-light rounded-3 border">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <div className="fw-bold text-dark small d-flex align-items-center gap-1.5">
              <Activity size={16} className="text-primary" />
              <span>Ngữ điệu câu & Nhịp ngắt nghỉ (F0)</span>
              <span className="badge bg-info bg-opacity-10 text-dark border border-info">
                Thử nghiệm · Experimental
              </span>
            </div>
            <span className="badge bg-white text-secondary border">
              Độ tin cậy F0: <strong>{intonation.reliability || 'UNRELIABLE'}</strong>
            </span>
          </div>

          {intonation.f0Available ? (
            <div className="d-flex flex-column gap-2">
              <div className="d-flex flex-wrap gap-2 small">
                <span className="badge bg-white text-dark border">
                  Cuối câu: <strong>{FINAL_MOVEMENT_VI[intonation.finalPitchMovement] || intonation.finalPitchMovement}</strong>
                  {intonation.finalPitchMatch === true && ' ✓'}
                  {intonation.finalPitchMatch === false && ' ⚠'}
                </span>
                {intonation.medianF0Hz && (
                  <span className="badge bg-white text-dark border">
                    F0 trung vị: <strong>{Math.round(intonation.medianF0Hz)} Hz</strong>
                  </span>
                )}
                {intonation.pitchRangeSemitones !== null && intonation.pitchRangeSemitones !== undefined && (
                  <span className="badge bg-white text-dark border">
                    Biên độ: <strong>{intonation.pitchRangeSemitones} bán cung</strong>
                  </span>
                )}
                {intonation.speakingDurationSec !== null && intonation.speakingDurationSec !== undefined && (
                  <span className="badge bg-white text-dark border">
                    Thời lượng nói: <strong>{intonation.speakingDurationSec}s</strong>
                  </span>
                )}
                <span className="badge bg-white text-dark border">
                  Ngắt nghỉ giữa câu: <strong>{(intonation.pauseAnalysis || []).length} lần</strong>
                </span>
              </div>

              {intonation.referenceComparisonAvailable && intonation.referenceComparison && (
                <div className="small px-2.5 py-2 bg-primary bg-opacity-10 rounded-3 border border-primary border-opacity-25">
                  <strong>So sánh đường cao độ F0 với bản mẫu (DTW chuẩn hóa):</strong> Sai lệch trung bình{' '}
                  <strong>{intonation.referenceComparison.dtwMaeSemitones} bán cung</strong> · Tương quan{' '}
                  <strong>{intonation.referenceComparison.contourCorrelation}</strong> · Tỉ lệ tốc độ{' '}
                  <strong>{intonation.referenceComparison.durationRatio}x</strong>
                </div>
              )}

              <PitchContourChart contour={intonation.pitchContour} />

              {intonation.feedback && intonation.feedback.length > 0 && (
                <ul className="small mb-0 ps-3 text-dark">
                  {intonation.feedback.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="small text-muted">
              Không đủ dữ liệu cao độ F0 để chấm ngữ điệu câu cho lượt ghi âm này.
            </div>
          )}
        </div>
      )}

      {/* 8. Forced Alignment Timing Segments (Collapsible) */}
      {alignment && alignment.available && alignment.segments && alignment.segments.length > 0 && (
        <div className="p-3 bg-light rounded-3 border">
          <div className="d-flex justify-content-between align-items-center">
            <div className="fw-bold text-dark small d-flex align-items-center gap-1.5">
              <Clock size={15} className="text-secondary" />
              <span>Mốc thời gian căn chỉnh âm thanh ({alignment.segments.length} đơn vị · ForcedAligner)</span>
            </div>
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none d-inline-flex align-items-center gap-1"
              onClick={() => setShowAlignment((v) => !v)}
            >
              <span>{showAlignment ? 'Ẩn mốc' : 'Xem mốc'}</span>
              {showAlignment ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
          {showAlignment && (
            <div className="d-flex flex-wrap gap-1.5 mt-2">
              {alignment.segments.map((seg, idx) => (
                <span key={idx} className="badge bg-white text-dark border font-jp py-1.5 px-2">
                  <strong>{seg.unit}</strong>{' '}
                  <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                    {Number(seg.startTime).toFixed(2)}s–{Number(seg.endTime).toFixed(2)}s
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9 & 10. AI Vietnamese Explanation & Practice Suggestions */}
      {feedback && (feedback.summary || (feedback.explanations && feedback.explanations.length > 0)) && (
        <div className="p-3 rounded-3 border bg-success bg-opacity-10 border-success border-opacity-25">
          <div className="fw-bold text-success small d-flex align-items-center gap-1.5 mb-1.5">
            <MessageSquareText size={16} />
            <span>Nhận xét & Gợi ý luyện tập</span>
          </div>

          {feedback.summary && <p className="small text-dark fw-medium mb-2">{feedback.summary}</p>}

          {feedback.explanations && feedback.explanations.length > 0 && (
            <div className="d-flex flex-column gap-2 mb-2">
              {feedback.explanations.map((exp, idx) => (
                <div key={idx} className="p-2.5 bg-white rounded-3 border small">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <span className="badge bg-secondary bg-opacity-10 text-secondary border">{exp.category}</span>
                    {exp.incorrectFragment && (
                      <span className="text-danger font-jp fw-semibold">✗ {exp.incorrectFragment}</span>
                    )}
                    {exp.correctFragment && (
                      <span className="text-success font-jp fw-semibold">→ ✓ {exp.correctFragment}</span>
                    )}
                  </div>
                  <div className="text-dark">{exp.reason}</div>
                  {exp.suggestion && <div className="text-primary mt-0.5">💡 {exp.suggestion}</div>}
                </div>
              ))}
            </div>
          )}

          {feedback.practiceSuggestions && feedback.practiceSuggestions.length > 0 && (
            <div className="small mb-2">
              <div className="fw-semibold text-dark d-flex align-items-center gap-1 mb-1">
                <Sparkles size={14} className="text-warning" />
                <span>Gợi ý luyện tiếp:</span>
              </div>
              <ul className="mb-0 ps-3 text-dark">
                {feedback.practiceSuggestions.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {feedback.encouragement && (
            <div className="small fw-semibold text-success border-top border-success border-opacity-25 pt-2 mt-1">
              {feedback.encouragement}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShadowingEvaluationPanel;
