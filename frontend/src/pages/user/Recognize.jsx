import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import AudioButton from '../../components/common/AudioButton';
import FuriganaText from '../../components/common/FuriganaText';
import {
  Camera,
  Upload,
  Sparkles,
  BookmarkPlus,
  Check,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  History,
  ThumbsUp,
  ThumbsDown,
  X,
  CheckSquare,
  Square,
  BookMarked,
} from 'lucide-react';

export const Recognize = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [jlptLevel, setJlptLevel] = useState('N5');
  const [topicHint, setTopicHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveBanner, setSaveBanner] = useState(null);
  const [result, setResult] = useState(null);
  const [savedWordIndexes, setSavedWordIndexes] = useState(new Set());
  const [selectedIndexes, setSelectedIndexes] = useState(new Set());
  const [savingBatch, setSavingBatch] = useState(false);

  // History state
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await axiosClient.get('/recognitions?size=8');
      if (res.success && res.data) {
        const items = Array.isArray(res.data) ? res.data : (res.data.content || []);
        setHistoryList(items);
      }
    } catch (err) {
      console.error('Fetch recognition history failed:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      setError('Không thể truy cập Camera. Vui lòng cấp quyền Camera cho trình duyệt hoặc chọn tệp ảnh từ máy.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setResult(null);
        setSavedWordIndexes(new Set());
        setSelectedIndexes(new Set());
        setSaveBanner(null);
        stopCamera();
      }
    }, 'image/jpeg', 0.92);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chỉ chọn tệp hình ảnh (.jpg, .png, .webp)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Kích thước ảnh không được vượt quá 10MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
    setResult(null);
    setSavedWordIndexes(new Set());
    setSelectedIndexes(new Set());
    setSaveBanner(null);
  };

  const handleRecognize = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Vui lòng chọn hoặc chụp một bức ảnh trước khi phân tích.');
      return;
    }

    setLoading(true);
    setError('');
    setSaveBanner(null);
    setSavedWordIndexes(new Set());

    const formData = new FormData();
    formData.append('image', selectedFile);
    if (jlptLevel) formData.append('jlptLevel', jlptLevel);
    if (topicHint) formData.append('topicHint', topicHint);

    try {
      const res = await axiosClient.post('/recognitions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.success && res.data) {
        setResult(res.data);
        const vocabs = res.data.items || res.data.vocabularies || [];
        // Mặc định chọn tất cả các từ mới nhận diện để tiện lưu hàng loạt
        setSelectedIndexes(new Set(vocabs.map((_, i) => i)));
        fetchHistory();
      } else {
        throw new Error(res.message || 'Không thể nhận diện hình ảnh.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi kết nối dịch vụ Gemini AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (recId, isCorrect) => {
    try {
      await axiosClient.patch(`/recognitions/${recId}/feedback`, { isCorrect });
      if (result && result.recognitionId === recId) {
        setResult({ ...result, isCorrect });
      }
      fetchHistory();
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  const currentVocabs = result?.items || result?.vocabularies || [];

  const toggleSelectIndex = (idx) => {
    setSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIndexes(new Set(currentVocabs.map((_, idx) => idx)));
  };

  const handleDeselectAll = () => {
    setSelectedIndexes(new Set());
  };

  const buildVocabPayload = (item) => ({
    word: item.word || item.japaneseText,
    japaneseText: item.word || item.japaneseText,
    reading: item.reading || null,
    romaji: item.romaji || null,
    meaningVi: item.meaningVi || item.vietnameseMeaning,
    vietnameseMeaning: item.meaningVi || item.vietnameseMeaning,
    partOfSpeech: item.partOfSpeech || null,
    hanViet: item.hanViet || null,
    jlptLevel: item.jlptLevel || jlptLevel,
    exampleJa: item.exampleJa || item.exampleSentence || null,
    exampleSentence: item.exampleJa || item.exampleSentence || null,
    exampleVi: item.exampleVi || item.exampleMeaning || null,
    exampleMeaning: item.exampleVi || item.exampleMeaning || null,
    exampleReading: item.exampleReading || null,
    source: 'AI_IMAGE',
  });

  const handleSaveSingleWord = async (item, index) => {
    setSaveBanner(null);
    try {
      const res = await axiosClient.post('/vocab/my', buildVocabPayload(item));
      if (res.success) {
        setSavedWordIndexes((prev) => new Set(prev).add(index));
        setSaveBanner({
          type: 'success',
          message: `Đã lưu từ "${item.word || item.japaneseText}" vào Sổ từ vựng cá nhân!`,
        });
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setSavedWordIndexes((prev) => new Set(prev).add(index));
        setSaveBanner({
          type: 'info',
          message: `Từ "${item.word || item.japaneseText}" đã tồn tại trong Sổ từ vựng cá nhân của bạn.`,
        });
      } else {
        setSaveBanner({
          type: 'danger',
          message: err.response?.data?.message || 'Lưu từ vựng thất bại.',
        });
      }
    }
  };

  const handleSaveSelected = async () => {
    const indexes = Array.from(selectedIndexes);
    if (indexes.length === 0) {
      setSaveBanner({ type: 'warning', message: 'Vui lòng tích chọn ít nhất 1 từ vựng để lưu.' });
      return;
    }

    setSavingBatch(true);
    setSaveBanner(null);

    try {
      const itemsToSave = indexes.map((idx) => buildVocabPayload(currentVocabs[idx]));
      const res = await axiosClient.post('/vocab/my/bulk', { items: itemsToSave });

      if (res.success) {
        const savedCount = Array.isArray(res.data) ? res.data.length : 0;
        const dupCount = Math.max(0, itemsToSave.length - savedCount);
        setSavedWordIndexes((prev) => {
          const next = new Set(prev);
          indexes.forEach((idx) => next.add(idx));
          return next;
        });
        setSaveBanner({
          type: 'success',
          message:
            dupCount > 0
              ? `Đã lưu thành công ${savedCount} từ mới vào Sổ từ vựng cá nhân (${dupCount} từ đã tồn tại trước đó).`
              : `Đã lưu thành công ${savedCount} từ vào Sổ từ vựng cá nhân!`,
        });
      }
    } catch (err) {
      setSaveBanner({
        type: 'danger',
        message: err.response?.data?.message || 'Lưu danh sách từ vựng thất bại.',
      });
    } finally {
      setSavingBatch(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0">Nhận diện từ vựng qua ảnh AI</h3>
            <span className="badge bg-danger fw-bold">Gemini Vision</span>
          </div>
          <p className="text-muted small mb-0">
            Chụp hoặc tải lên biển hiệu, menu, đồ vật, trang sách bất kỳ để Gemini AI trích xuất từ vựng kèm Furigana, Hán Việt, nghĩa và ví dụ.
          </p>
        </div>

        <Link to="/app/my-vocab" className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1.5">
          <BookMarked size={16} />
          <span>Mở Sổ từ vựng cá nhân</span>
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2.5 px-3 small rounded-3 mb-0">
          <AlertCircle size={18} className="flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {saveBanner && (
        <div className={`alert alert-${saveBanner.type} d-flex justify-content-between align-items-center gap-2 py-2.5 px-3 small rounded-3 mb-0`}>
          <div className="d-flex align-items-center gap-2">
            <Check size={18} className="flex-shrink-0" />
            <span>{saveBanner.message}</span>
          </div>
          <Link to="/app/my-vocab" className="btn btn-sm btn-primary fw-semibold">
            Xem trong Sổ từ vựng →
          </Link>
        </div>
      )}

      <div className="row g-4">
        {/* Upload & Camera Column */}
        <div className="col-12 col-lg-5">
          <div className="card pq-card p-4">
            <h5 className="fw-bold mb-3">Chọn hoặc chụp ảnh</h5>

            {cameraOpen ? (
              <div className="mb-3 text-center bg-dark rounded-3 p-2 position-relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-100 rounded-2"
                  style={{ maxHeight: '280px', objectFit: 'cover' }}
                />
                <div className="d-flex justify-content-center gap-2 mt-2">
                  <button type="button" className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={capturePhoto}>
                    <Camera size={16} /> Chụp ảnh này
                  </button>
                  <button type="button" className="btn btn-light btn-sm d-flex align-items-center gap-1" onClick={stopCamera}>
                    <X size={16} /> Đóng Camera
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="border border-2 border-dashed rounded-3 p-4 text-center mb-3 position-relative d-flex flex-column align-items-center justify-content-center"
                style={{
                  minHeight: '240px',
                  backgroundColor: 'var(--surface-raised)',
                  borderColor: 'var(--line-strong)',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('imageUploadInput').click()}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="img-fluid rounded-3 shadow-xs"
                    style={{ maxHeight: '220px', objectFit: 'contain' }}
                  />
                ) : (
                  <>
                    <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary mb-2">
                      <Upload size={28} />
                    </div>
                    <div className="fw-semibold text-dark">Nhấp để chọn ảnh từ máy</div>
                    <div className="small text-muted mt-1">Hỗ trợ JPG, PNG, WEBP (tối đa 10MB)</div>
                  </>
                )}

                <input
                  id="imageUploadInput"
                  type="file"
                  accept="image/*"
                  className="d-none"
                  onChange={handleFileChange}
                />
              </div>
            )}

            <div className="d-flex gap-2 mb-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1.5"
                onClick={() => document.getElementById('imageUploadInput').click()}
              >
                <Upload size={15} /> Chọn tệp ảnh
              </button>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1.5"
                onClick={cameraOpen ? stopCamera : startCamera}
              >
                <Camera size={15} /> {cameraOpen ? 'Tắt Camera' : 'Chụp bằng Camera'}
              </button>
            </div>

            <form onSubmit={handleRecognize}>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-semibold text-secondary">Trình độ ưu tiên</label>
                  <select
                    className="form-select"
                    value={jlptLevel}
                    onChange={(e) => setJlptLevel(e.target.value)}
                  >
                    <option value="N5">N5 (Cơ bản)</option>
                    <option value="N4">N4 (Sơ cấp)</option>
                    <option value="N3">N3 (Trung cấp)</option>
                    <option value="N2">N2 (Trung cao)</option>
                    <option value="N1">N1 (Cao cấp)</option>
                  </select>
                </div>

                <div className="col-6">
                  <label className="form-label small fw-semibold text-secondary">Gợi ý chủ đề</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="VD: Quán ăn, Trường học"
                    value={topicHint}
                    onChange={(e) => setTopicHint(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-sky w-100 py-2.5 d-flex align-items-center justify-content-center gap-2"
                disabled={loading || !selectedFile}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="spinner-border spinner-border-sm" />
                    <span>Gemini AI đang phân tích ảnh...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Phân tích hình ảnh</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Results Column */}
        <div className="col-12 col-lg-7">
          <div className="card pq-card p-4 h-100">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h5 className="fw-bold mb-0">Kết quả trích xuất từ ảnh</h5>
                <span className="small text-muted">
                  {result
                    ? `Tìm thấy ${currentVocabs.length} từ vựng (Đã chọn: ${selectedIndexes.size} từ)`
                    : 'Chưa có kết quả phân tích'}
                </span>
              </div>

              {currentVocabs.length > 0 && (
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-light btn-sm border d-flex align-items-center gap-1"
                    onClick={selectedIndexes.size === currentVocabs.length ? handleDeselectAll : handleSelectAll}
                  >
                    {selectedIndexes.size === currentVocabs.length ? (
                      <>
                        <Square size={14} />
                        <span>Bỏ chọn tất cả</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare size={14} />
                        <span>Chọn tất cả ({currentVocabs.length})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm d-flex align-items-center gap-1.5"
                    onClick={handleSaveSelected}
                    disabled={savingBatch || selectedIndexes.size === 0}
                  >
                    {savingBatch ? (
                      <Loader2 size={14} className="spinner-border spinner-border-sm" />
                    ) : (
                      <BookmarkPlus size={15} />
                    )}
                    <span>Lưu {selectedIndexes.size} từ đã chọn vào sổ</span>
                  </button>
                </div>
              )}
            </div>

            {!result && !loading && (
              <div className="text-center py-5 text-muted my-auto">
                <ImageIcon size={48} className="mb-2 opacity-50 mx-auto" />
                <div>Vui lòng chọn ảnh và bấm <strong>"Phân tích hình ảnh"</strong></div>
              </div>
            )}

            {loading && (
              <div className="text-center py-5 my-auto">
                <div className="spinner-border text-primary mb-3" role="status"></div>
                <div className="fw-semibold text-dark">Đang gửi hình ảnh tới Google Gemini Vision...</div>
                <div className="small text-muted mt-1">Hệ thống đang nhận diện vật thể/văn bản và trích xuất từ vựng tiếng Nhật</div>
              </div>
            )}

            {result && currentVocabs.length === 0 && (
              <div className="text-center py-5 text-muted my-auto">
                <div>AI không phát hiện được từ vựng hoặc sự vật rõ ràng trong bức ảnh này. Hãy thử một bức ảnh rõ nét hơn.</div>
              </div>
            )}

            {currentVocabs.length > 0 && (
              <>
                <div className="d-flex flex-column gap-3">
                  {currentVocabs.map((item, idx) => {
                    const isSaved = savedWordIndexes.has(idx);
                    const isChecked = selectedIndexes.has(idx);
                    const jpText = item.word || item.japaneseText;
                    const viMeaning = item.meaningVi || item.vietnameseMeaning;
                    const exJa = item.exampleJa || item.exampleSentence;
                    const exVi = item.exampleVi || item.exampleMeaning;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-3 border ${
                          isChecked ? 'border-primary bg-primary bg-opacity-10' : 'bg-light'
                        }`}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="d-flex align-items-start gap-2.5">
                            <input
                              type="checkbox"
                              className="form-check-input mt-2"
                              checked={isChecked}
                              onChange={() => toggleSelectIndex(idx)}
                              style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                            />
                            <div>
                              <div className="d-flex flex-wrap align-items-center gap-2">
                                <span className="fs-4 fw-bold font-jp text-dark">
                                  <FuriganaText text={`${jpText}[${item.reading || ''}]`} />
                                </span>
                                <AudioButton text={jpText} />
                                {item.reading && (
                                  <span className="badge bg-white text-secondary border font-jp">
                                    {item.reading}
                                  </span>
                                )}
                                {item.hanViet && (
                                  <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                    Hán Việt: {item.hanViet.toUpperCase()}
                                  </span>
                                )}
                                <span className={`badge badge-jlpt-${(item.jlptLevel || 'n5').toLowerCase()}`}>
                                  {item.jlptLevel || 'N5'}
                                </span>
                                {item.partOfSpeech && (
                                  <span className="badge bg-light text-secondary border">
                                    {item.partOfSpeech}
                                  </span>
                                )}
                              </div>
                              {item.romaji && (
                                <div className="small text-muted">Romaji: {item.romaji}</div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`btn btn-sm d-flex align-items-center gap-1 flex-shrink-0 ${
                              isSaved ? 'btn-success' : 'btn-outline-primary bg-white'
                            }`}
                            onClick={() => handleSaveSingleWord(item, idx)}
                            disabled={isSaved}
                          >
                            {isSaved ? (
                              <>
                                <Check size={14} />
                                <span>Đã lưu</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus size={14} />
                                <span>+ Lưu sổ từ</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="fw-bold text-dark mt-2 ps-4">{viMeaning}</div>

                        {exJa && (
                          <div className="mt-2 pt-2 border-top small ps-4">
                            <div className="d-flex align-items-center gap-1 font-jp text-dark">
                              <strong>Ví dụ:</strong> <FuriganaText text={exJa} />
                              <AudioButton text={exJa} size="sm" />
                            </div>
                            {item.exampleReading && (
                              <div className="text-muted font-jp small">Hiragana: {item.exampleReading}</div>
                            )}
                            {exVi && <div className="text-muted fst-italic">{exVi}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* AI Recognition Quality Feedback */}
                {result.recognitionId && (
                  <div className="mt-3 pt-3 border-top d-flex justify-content-between align-items-center small text-muted">
                    <span>Kết quả nhận diện AI có chính xác với ảnh của bạn không?</span>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm d-flex align-items-center gap-1 ${
                          result.isCorrect === true ? 'btn-success' : 'btn-outline-secondary'
                        }`}
                        onClick={() => handleFeedback(result.recognitionId, true)}
                      >
                        <ThumbsUp size={14} /> Chính xác
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm d-flex align-items-center gap-1 ${
                          result.isCorrect === false ? 'btn-danger' : 'btn-outline-secondary'
                        }`}
                        onClick={() => handleFeedback(result.recognitionId, false)}
                      >
                        <ThumbsDown size={14} /> Báo lỗi AI
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recognition History Section */}
      <div className="card pq-card p-4">
        <div className="d-flex align-items-center gap-2 mb-3">
          <History size={18} className="text-primary" />
          <h5 className="fw-bold mb-0">Lịch sử nhận diện ảnh gần đây</h5>
        </div>

        {loadingHistory ? (
          <div className="text-center py-3 text-muted small">Đang tải lịch sử nhận diện...</div>
        ) : historyList.length === 0 ? (
          <div className="text-center py-4 text-muted small">Chưa có lịch sử nhận diện hình ảnh nào.</div>
        ) : (
          <div className="row g-3">
            {historyList.map((rec) => {
              const items = rec.items || rec.vocabularies || [];
              return (
                <div key={rec.recognitionId} className="col-12 col-md-6 col-xl-3">
                  <div
                    className="p-3 rounded-3 border bg-light h-100 d-flex flex-column justify-content-between"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setResult(rec);
                      setSavedWordIndexes(new Set());
                      setSelectedIndexes(new Set(items.map((_, i) => i)));
                      setSaveBanner(null);
                    }}
                  >
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="badge bg-primary bg-opacity-10 text-primary">
                          {items.length} từ vựng
                        </span>
                        <span className="small text-muted">
                          {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('vi-VN') : ''}
                        </span>
                      </div>
                      <div className="d-flex flex-wrap gap-1 mb-2">
                        {items.slice(0, 4).map((w, i) => (
                          <span key={i} className="badge bg-white text-dark border font-jp">
                            {w.word || w.japaneseText}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="small text-primary fw-semibold mt-1">Xem lại kết quả →</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Recognize;
