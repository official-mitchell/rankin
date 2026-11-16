// Landing shell so the Worker SPA fallback has a real page to serve.
export function App({ title }: { title: string }) {
  return (
    <main style={{ fontFamily: "Inter, Helvetica, sans-serif", padding: 24, color: "#14171f" }}>
      <h1 style={{ fontSize: 28, lineHeight: "32px" }}>{title}</h1>
      <p style={{ color: "#5b6270" }}>Pitch night is almost ready.</p>
    </main>
  );
}
