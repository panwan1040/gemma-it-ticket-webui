export default function LoadingButton({ loading, children, loadingText = 'กำลังทำงาน...', ...props }) {
  return (
    <button {...props} disabled={loading || props.disabled}>
      {loading ? loadingText : children}
    </button>
  );
}
