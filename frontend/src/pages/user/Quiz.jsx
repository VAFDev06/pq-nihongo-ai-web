import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import AudioButton from '../../components/common/AudioButton';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  ArrowRight,
  Award,
  AlertCircle,
} from 'lucide-react';

export const Quiz = () => {
  const { id: deckId } = useParams();

  const [quizMode, setQuizMode] = useState('MULTIPLE_CHOICE'); // 'MULTIPLE_CHOICE' | 'FILL_IN' | 'LISTENING'
  const [sessionId, setSessionId] = useState(null);
  const [deckName, setDeckName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const [fillInput, setFillInput] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const startQuiz = async (mode) => {
    setQuizMode(mode);
    setLoading(true);
    setError('');
    setQuizFinished(false);
    setCurrentIdx(0);
    setScore(0);
    setIsAnswered(false);
    setSelectedOption('');
    setFillInput('');

    try {
      const res = await axiosClient.post(`/decks/${deckId}/quiz/start`, {
        quizType: mode,
        type: mode,
        count: 10,
      });

      if (res.success && res.data) {
        setSessionId(res.data.sessionId);
        setDeckName(res.data.deckName || '');
        setQuestions(res.data.questions || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Bộ thẻ cần tối thiểu 3 thẻ để tạo đề thi Quiz.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startQuiz('MULTIPLE_CHOICE');
  }, [deckId]);

  const currentQ = questions[currentIdx];

  const submitAnswerToBackend = async (flashcardId, userAnswer) => {
    if (!sessionId) return null;
    try {
      const res = await axiosClient.post(`/quiz/${sessionId}/answer`, {
        flashcardId,
        answer: userAnswer,
      });
      if (res.success && res.data) {
        return res.data.isCorrect;
      }
    } catch (err) {
      console.error('Submit quiz answer error:', err);
    }
    return null;
  };

  const handleSelectOption = async (opt) => {
    if (isAnswered || !currentQ) return;
    setSelectedOption(opt);
    setIsAnswered(true);

    const serverCorrect = await submitAnswerToBackend(currentQ.flashcardId, opt);
    const isCorrect = serverCorrect !== null ? serverCorrect : (opt === currentQ.correctAnswer);
    setLastAnswerCorrect(isCorrect);
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const handleSubmitFill = async (e) => {
    e.preventDefault();
    if (isAnswered || !fillInput.trim() || !currentQ) return;
    const ans = fillInput.trim();
    setIsAnswered(true);

    const serverCorrect = await submitAnswerToBackend(currentQ.flashcardId, ans);
    const localCorrect =
      ans.toLowerCase() === (currentQ.correctAnswer || '').trim().toLowerCase() ||
      (currentQ.reading && ans.toLowerCase() === currentQ.reading.trim().toLowerCase());
    const isCorrect = serverCorrect !== null ? serverCorrect : localCorrect;
    setLastAnswerCorrect(isCorrect);
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = async () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setIsAnswered(false);
      setSelectedOption('');
      setFillInput('');
    } else {
      if (sessionId) {
        try {
          await axiosClient.post(`/quiz/${sessionId}/finish`);
        } catch (err) {
          console.error('Finish quiz error:', err);
        }
      }
      setQuizFinished(true);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Đang tạo đề thi Quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card pq-card p-5 text-center my-4" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <AlertCircle size={48} className="text-danger mx-auto mb-3" />
        <h5 className="fw-bold text-dark mb-2">Không thể khởi tạo bài Quiz</h5>
        <p className="text-muted small mb-4">{error}</p>
        <Link to={`/app/decks/${deckId}`} className="btn btn-sky mx-auto">
          Quay lại bộ thẻ để thêm thẻ
        </Link>
      </div>
    );
  }

  if (quizFinished) {
    const percent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="card pq-card p-5 text-center my-4" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Award size={64} className="text-warning mx-auto mb-3" />
        <h3 className="fw-bold text-dark mb-1">Kết quả bài kiểm tra Quiz</h3>
        <p className="text-muted small mb-4">
          Bộ thẻ: <strong>{deckName}</strong> · Chế độ: <strong>{quizMode}</strong>
        </p>

        <div className="p-4 bg-light rounded-4 mb-4 border">
          <div className="display-4 fw-bold text-primary mb-1">{score} / {questions.length}</div>
          <div className="fw-semibold text-secondary">Đạt {percent}% độ chính xác</div>
          <div className="small text-muted mt-2">
            Các thẻ trả lời sai đã được tự động đưa vào danh sách ưu tiên ôn tập SRS (Relearning).
          </div>
        </div>

        <div className="d-flex justify-content-center gap-3">
          <button className="btn btn-outline-secondary" onClick={() => startQuiz(quizMode)}>
            Làm lại bài này
          </button>
          <Link to={`/app/decks/${deckId}`} className="btn btn-sky">
            Về chi tiết bộ thẻ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-4" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Top Header */}
      <div className="d-flex justify-content-between align-items-center">
        <Link to={`/app/decks/${deckId}`} className="btn btn-light btn-sm text-muted">
          <ArrowLeft size={18} />
        </Link>

        {/* Mode Selector */}
        <div className="btn-group btn-group-sm">
          <button
            className={`btn ${quizMode === 'MULTIPLE_CHOICE' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => startQuiz('MULTIPLE_CHOICE')}
          >
            Trắc nghiệm
          </button>
          <button
            className={`btn ${quizMode === 'FILL_IN' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => startQuiz('FILL_IN')}
          >
            Điền từ
          </button>
          <button
            className={`btn ${quizMode === 'LISTENING' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => startQuiz('LISTENING')}
          >
            Luyện nghe
          </button>
        </div>

        <span className="small text-muted fw-bold">
          Câu {currentIdx + 1} / {questions.length}
        </span>
      </div>

      {/* Question Card */}
      {currentQ && (
        <div className="card pq-card p-4 p-md-5">
          <div className="text-center mb-4">
            <span className="badge bg-light text-secondary border mb-2">
              {quizMode === 'LISTENING'
                ? 'Nghe phát âm tiếng Nhật và chọn nghĩa đúng'
                : quizMode === 'FILL_IN'
                ? 'Nhập từ tiếng Nhật (Kanji hoặc Hiragana) tương ứng với nghĩa'
                : 'Chọn nghĩa tiếng Việt chính xác'}
            </span>

            {quizMode === 'LISTENING' ? (
              <div className="py-3">
                <AudioButton text={currentQ.questionAudio || currentQ.questionText} size="lg" />
                <div className="small text-muted mt-2">Bấm biểu tượng loa để nghe phát âm</div>
              </div>
            ) : (
              <h2 className="fw-bold font-jp text-dark my-2">
                {currentQ.questionText}
              </h2>
            )}

            {(currentQ.reading || currentQ.readingHint) && quizMode === 'MULTIPLE_CHOICE' && (
              <div className="text-muted small font-jp">Cách đọc: {currentQ.reading || currentQ.readingHint}</div>
            )}
          </div>

          {/* Options or Input based on mode */}
          {quizMode === 'FILL_IN' ? (
            <form onSubmit={handleSubmitFill} className="mb-3">
              <div className="input-group mb-3">
                <input
                  type="text"
                  className="form-control form-control-lg text-center font-jp"
                  placeholder="Nhập từ tiếng Nhật (Kanji hoặc Hiragana)..."
                  value={fillInput}
                  onChange={(e) => setFillInput(e.target.value)}
                  disabled={isAnswered}
                  autoFocus
                />
                {!isAnswered && (
                  <button type="submit" className="btn btn-sky px-4">
                    Kiểm tra
                  </button>
                )}
              </div>

              {isAnswered && (
                <div
                  className={`p-3 rounded-3 d-flex align-items-center gap-2 ${
                    lastAnswerCorrect
                      ? 'bg-success bg-opacity-10 text-success border border-success'
                      : 'bg-danger bg-opacity-10 text-danger border border-danger'
                  }`}
                >
                  {lastAnswerCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  <div>
                    Đáp án đúng: <strong className="font-jp">{currentQ.correctAnswer}</strong>
                    {currentQ.reading ? <span className="ms-1 font-jp">({currentQ.reading})</span> : ''}
                  </div>
                </div>
              )}
            </form>
          ) : (
            <div className="d-flex flex-column gap-2 mb-3">
              {currentQ.options?.map((opt, idx) => {
                let btnStyle = 'btn-outline-secondary text-start p-3';
                if (isAnswered) {
                  if (opt === currentQ.correctAnswer) {
                    btnStyle = 'btn-success text-start p-3 text-white fw-bold';
                  } else if (opt === selectedOption) {
                    btnStyle = 'btn-danger text-start p-3 text-white';
                  }
                }

                return (
                  <button
                    key={idx}
                    className={`btn ${btnStyle} rounded-3 d-flex justify-content-between align-items-center`}
                    onClick={() => handleSelectOption(opt)}
                    disabled={isAnswered}
                  >
                    <span>{opt}</span>
                    {isAnswered && opt === currentQ.correctAnswer && <CheckCircle size={18} />}
                    {isAnswered && opt === selectedOption && opt !== currentQ.correctAnswer && <XCircle size={18} />}
                  </button>
                );
              })}
            </div>
          )}

          {isAnswered && (
            <button
              className="btn btn-sky w-100 py-2 d-flex align-items-center justify-content-center gap-2 mt-3"
              onClick={handleNext}
            >
              <span>{currentIdx + 1 < questions.length ? 'Câu tiếp theo' : 'Hoàn thành & Xem điểm'}</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Quiz;
