"use client";

/** Last-resort error boundary — replaces the whole document. Never leaks stacks. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#050505", color: "#e5e5e5", fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              width: "100%",
              border: "1px solid #202020",
              background: "#171717",
              borderRadius: "10px",
              padding: "2rem",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "18px", fontWeight: 600, color: "#fff", margin: 0 }}>
              500 — Internal Server Error
            </h1>
            <p style={{ fontSize: "13px", color: "#a3a3a3", marginTop: "0.5rem" }}>
              The application hit an unexpected error.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "1.5rem",
                height: "36px",
                padding: "0 16px",
                borderRadius: "6px",
                border: "1px solid #2b2b2b",
                background: "#202020",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
