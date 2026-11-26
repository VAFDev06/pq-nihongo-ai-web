import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import {
  FileSpreadsheet,
  Download,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from 'lucide-react';

export const ImportDeck = () => {
  const { id: deckId } = useParams();

  const [step, setStep] = useState(1); // 1: Select file, 2: Preview, 3: Success
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState('SKIP'); // 'SKIP' | 'UPDATE' | 'KEEP_OLD'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [commitResult, setCommitResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };

  const handleUploadPreview = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV (.csv).');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await axiosClient.post(`/decks/${deckId}/import/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.success && res.data) {
        setPreviewData(res.data);
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đọc file. Vui lòng kiểm tra định dạng.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!previewData?.jobId) return;
    setLoading(true);
    setError('');

    try {
      const res = await axiosClient.post(`/decks/${deckId}/import/commit`, {
        jobId: previewData.jobId,
        onDuplicate: duplicateStrategy,
        duplicateStrategy,
      });

      if (res.success && res.data) {
        setCommitResult(res.data);
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Nhập dữ liệu thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4" style={{ maxWidth: '1020px', margin: '0 auto' }}>
      {/* Header */}
      <div className="d-flex align-items-center gap-2">
        <Link to={`/app/decks/${deckId}`} className="btn btn-light btn-sm p-2 text-muted">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h3 className="fw-bold mb-0">Import từ vựng từ File Excel / CSV</h3>
          <p className="text-muted small mb-0">
            Hỗ trợ mẫu Excel 7 cột chuẩn (Kanji, Từ loại, Nghĩa tiếng Việt, Hiragana, Hán Việt, Ví dụ tiếng Nhật kèm dịch, Hiragana ví dụ) và tương thích mẫu 6 cột cũ
          </p>
        </div>
      </div>

      {/* Wizard Steps indicator */}
      <div className="d-flex justify-content-between position-relative mb-2">
        <div className={`text-center flex-grow-1 ${step >= 1 ? 'fw-bold text-primary' : 'text-muted'}`}>
          <div className={`rounded-circle mx-auto mb-1 d-flex align-items-center justify-content-center ${step >= 1 ? 'bg-primary text-white' : 'bg-light text-muted border'}`} style={{ width: '32px', height: '32px' }}>
            1
          </div>
          <span className="small">Chọn file Excel/CSV</span>
        </div>
        <div className={`text-center flex-grow-1 ${step >= 2 ? 'fw-bold text-primary' : 'text-muted'}`}>
          <div className={`rounded-circle mx-auto mb-1 d-flex align-items-center justify-content-center ${step >= 2 ? 'bg-primary text-white' : 'bg-light text-muted border'}`} style={{ width: '32px', height: '32px' }}>
            2
          </div>
          <span className="small">Xem trước & Kiểm tra lỗi</span>
        </div>
        <div className={`text-center flex-grow-1 ${step >= 3 ? 'fw-bold text-primary' : 'text-muted'}`}>
          <div className={`rounded-circle mx-auto mb-1 d-flex align-items-center justify-content-center ${step >= 3 ? 'bg-success text-white' : 'bg-light text-muted border'}`} style={{ width: '32px', height: '32px' }}>
            3
          </div>
          <span className="small">Hoàn tất</span>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 small rounded-3">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Step 1: File Selection & Template Download */}
      {step === 1 && (
        <div className="card pq-card p-4">
          <h5 className="fw-bold mb-3">Tải file Excel / CSV lên</h5>

          <div className="p-3 bg-light rounded-3 border mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <div className="fw-bold text-dark">Định dạng mẫu Excel 7 cột chuẩn:</div>
              <div className="small text-muted">
                <code>Kanji | Từ loại | Nghĩa tiếng Việt | Hiragana | Hán Việt | Ví dụ tiếng Nhật (kèm dịch) | Hiragana ví dụ</code>
              </div>
              <div className="small text-secondary mt-1">
                VD: <strong>男性</strong> | Danh từ | Nam giới, đàn ông | だんせい | Nam tính | 理想の男性と結婚する。(Kết hôn với người đàn ông lý tưởng.) | りそうのだんせいとけっこんする。
              </div>
            </div>
            <div className="d-flex gap-2">
              <a href="/api/v1/templates/flashcard.xlsx" download className="btn btn-primary btn-sm d-flex align-items-center gap-1">
                <Download size={14} /> <span>Tải mẫu Excel (.xlsx)</span>
              </a>
              <a href="/api/v1/templates/flashcard.csv" download className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
                <Download size={14} /> <span>Tải mẫu CSV</span>
              </a>
            </div>
          </div>

          <form onSubmit={handleUploadPreview}>
            <div
              className="border border-2 border-dashed rounded-3 p-5 text-center mb-4 d-flex flex-column align-items-center justify-content-center"
              style={{
                backgroundColor: 'var(--surface-raised)',
                borderColor: 'var(--line-strong)',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('importFileInput').click()}
            >
              <FileSpreadsheet size={48} className="text-primary mb-2" />
              <div className="fw-semibold text-dark">
                {selectedFile ? selectedFile.name : 'Nhấp để chọn file Excel (.xlsx, .xls) hoặc CSV (.csv)'}
              </div>
              <div className="small text-muted">Hỗ trợ .xlsx, .xls, .csv dung lượng tối đa 5MB (tương thích cả mẫu 6 cột cũ và 7 cột mới)</div>
              <input
                id="importFileInput"
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="d-none"
                onChange={handleFileChange}
              />
            </div>

            <button
              type="submit"
              className="btn btn-sky w-100 py-2.5 d-flex align-items-center justify-content-center gap-2"
              disabled={loading || !selectedFile}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spinner-border spinner-border-sm" />
                  <span>Đang đọc và kiểm tra dữ liệu...</span>
                </>
              ) : (
                <>
                  <span>Tiếp tục xem trước dữ liệu</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Preview & Validation Table */}
      {step === 2 && previewData && (
        <div className="card pq-card p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div>
              <h5 className="fw-bold mb-0">Xem trước dữ liệu ({previewData.totalRows} dòng)</h5>
              <div className="small text-muted">
                Hợp lệ: <span className="text-success fw-bold">{previewData.validRows}</span> | Trùng lặp:{' '}
                <span className="text-warning fw-bold">{previewData.duplicateRows || 0}</span> | Lỗi:{' '}
                <span className="text-danger fw-bold">{previewData.errorRows}</span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <label className="small text-muted fw-semibold">Xử lý từ trùng:</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={duplicateStrategy}
                onChange={(e) => setDuplicateStrategy(e.target.value)}
              >
                <option value="SKIP">Bỏ qua từ trùng</option>
                <option value="UPDATE">Cập nhật đè bản cũ</option>
                <option value="KEEP_OLD">Giữ bản cũ</option>
              </select>
            </div>
          </div>

          <div className="table-responsive mb-4 border rounded-3" style={{ maxHeight: '420px' }}>
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light sticky-top">
                <tr>
                  <th>Dòng</th>
                  <th>Kanji</th>
                  <th>Từ loại</th>
                  <th>Nghĩa tiếng Việt</th>
                  <th>Hiragana</th>
                  <th>Hán Việt</th>
                  <th>Ví dụ & Dịch</th>
                  <th>Hiragana ví dụ</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {previewData.previewRows?.map((row, idx) => (
                  <tr key={idx} className={row.isValid ? (row.duplicate ? 'table-warning' : '') : 'table-danger'}>
                    <td className="small text-muted">{row.rowIndex}</td>
                    <td className="font-jp fw-bold">{row.word || row.japaneseText}</td>
                    <td className="small">{row.partOfSpeech || '-'}</td>
                    <td className="small fw-semibold">{row.meaningVi || row.vietnameseMeaning}</td>
                    <td className="font-jp small">{row.reading || '-'}</td>
                    <td className="small">{row.hanViet || '-'}</td>
                    <td className="small text-muted" style={{ maxWidth: '220px' }}>
                      <div className="font-jp text-truncate">{row.exampleJa || row.exampleSentence || '-'}</div>
                      {row.exampleVi && <div className="fst-italic text-truncate">({row.exampleVi})</div>}
                    </td>
                    <td className="font-jp small text-muted text-truncate" style={{ maxWidth: '160px' }}>
                      {row.exampleReading || '-'}
                    </td>
                    <td>
                      {!row.isValid ? (
                        <span className="badge bg-danger-subtle text-danger small" title={row.errorMessage}>
                          {row.errorMessage || 'Thiếu cột bắt buộc'}
                        </span>
                      ) : row.duplicate ? (
                        <span className="badge bg-warning-subtle text-warning-emphasis small">
                          Từ trùng
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success small">Hợp lệ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between">
            <button className="btn btn-outline-secondary" onClick={() => setStep(1)} disabled={loading}>
              Quay lại chọn file
            </button>
            <button
              className="btn btn-sky d-flex align-items-center gap-2"
              onClick={handleCommitImport}
              disabled={loading || previewData.validRows === 0}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spinner-border spinner-border-sm" />
                  <span>Đang lưu vào cơ sở dữ liệu...</span>
                </>
              ) : (
                <>
                  <span>Xác nhận import {previewData.validRows} dòng hợp lệ</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success Screen */}
      {step === 3 && commitResult && (
        <div className="card pq-card p-5 text-center">
          <CheckCircle size={64} className="text-success mx-auto mb-3" />
          <h4 className="fw-bold text-dark mb-1">Import dữ liệu thành công!</h4>
          <p className="text-muted mb-4">
            Đã lưu thành công <strong>{commitResult.successRows ?? commitResult.insertedCount ?? 0}</strong> thẻ, bỏ qua <strong>{commitResult.skippedRows ?? 0}</strong> dòng trùng lặp/lỗi.
          </p>

          <div className="d-flex justify-content-center gap-3">
            <Link to={`/app/decks/${deckId}`} className="btn btn-outline-secondary">
              Xem danh sách thẻ
            </Link>
            <Link to={`/app/decks/${deckId}/study`} className="btn btn-sky">
              Lật thẻ & Học ngay
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportDeck;
