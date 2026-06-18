export default function LoadingSpinner({ text = 'Running forecast...' }) {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
      <p className="loading-text">{text}</p>
    </div>
  );
}
