export default function Loading() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/15"
    >
      <div
        className="h-full w-1/3 bg-primary"
        style={{ animation: "site-loader-bar 1.2s ease-in-out infinite" }}
      />
    </div>
  );
}
