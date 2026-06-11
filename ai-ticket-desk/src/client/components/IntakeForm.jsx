import { useRef, useState } from 'react';
import FilePreviewList from './FilePreviewList.jsx';
import LoadingButton from './LoadingButton.jsx';
import ErrorMessage from './ErrorMessage.jsx';

export default function IntakeForm({ onAnalyze, loading }) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const addFiles = (fileList) => {
    setError('');
    setFiles((current) => [...current, ...Array.from(fileList ?? [])]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (index) => {
    setFiles((current) => current.filter((_file, itemIndex) => itemIndex !== index));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!message.trim() && files.length === 0) {
      setError('กรุณาระบุรายละเอียดปัญหาหรือแนบไฟล์อย่างน้อยหนึ่งไฟล์');
      return;
    }
    onAnalyze({ message, files });
  };

  return (
    <form className="card intake-form" onSubmit={submit}>
      <label>
        <span>รายละเอียดปัญหา</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={7}
          placeholder="เช่น เปิดไฟล์ไม่ได้ มีข้อความ error หรืออินเทอร์เน็ตใช้งานไม่ได้..."
        />
      </label>

      <label className="file-input">
        <span>ไฟล์แนบ</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={(event) => addFiles(event.target.files)}
        />
      </label>

      <FilePreviewList files={files} onRemove={removeFile} />
      <ErrorMessage message={error} />

      <div className="actions">
        <LoadingButton className="primary-button" type="submit" loading={loading} loadingText="กำลังวิเคราะห์...">
          วิเคราะห์และสร้างร่าง ticket
        </LoadingButton>
      </div>
    </form>
  );
}
