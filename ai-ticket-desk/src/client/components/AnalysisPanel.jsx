function EmptyText({ children }) {
  return <p className="muted">{children}</p>;
}

function Block({ value, empty }) {
  return value ? <pre className="analysis-text">{value}</pre> : <EmptyText>{empty}</EmptyText>;
}

export default function AnalysisPanel({ result }) {
  if (!result) return null;

  return (
    <section className="card stack">
      <div>
        <h2>ผลวิเคราะห์จาก AI</h2>
        <p className="muted">แยกส่วนที่ AI เห็นจากภาพ และข้อความที่ OCR อ่านได้</p>
      </div>

      {result.warnings?.length ? (
        <div className="warning-box">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <details open>
        <summary>Vision analysis</summary>
        <Block value={result.vision_result} empty="ไม่มีผลวิเคราะห์ภาพ" />
      </details>

      <details open>
        <summary>OCR result</summary>
        <Block value={result.ocr_result} empty="ไม่มีผล OCR" />
      </details>

      {result.debug ? (
        <details>
          <summary>Debug metadata</summary>
          <pre className="analysis-text">{JSON.stringify(result.debug, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  );
}
