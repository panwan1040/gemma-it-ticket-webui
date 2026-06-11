import { formatBytes } from '../lib/format.js';

export default function FilePreviewList({ files = [], onRemove }) {
  if (!files.length) return <p className="muted">ยังไม่ได้เลือกไฟล์</p>;

  return (
    <ul className="file-list">
      {files.map((file, index) => (
        <li key={`${file.name}-${file.size}-${index}`}>
          <span>
            <strong>{file.name}</strong>
            <small>
              {file.type || 'unknown'} · {formatBytes(file.size)}
            </small>
          </span>
          {onRemove ? (
            <button type="button" className="ghost-button small-button" onClick={() => onRemove(index)}>
              ลบ
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
