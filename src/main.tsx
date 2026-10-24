import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./session";
import App from "./App";
import "./styles.css";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
const root = createRoot(document.getElementById("root")!);

if (!url) {
  root.render(
    <div style={{ padding: 32, fontFamily: "system-ui" }}>
      <h1>Convex is not configured</h1>
      <p>
        Run <code>npm run dev</code> (which starts <code>convex dev</code> and writes <code>VITE_CONVEX_URL</code> to{" "}
        <code>.env.local</code>), then reload.
      </p>
    </div>,
  );
} else {
  const convex = new ConvexReactClient(url);
  root.render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <BrowserRouter>
          <SessionProvider>
            <App />
          </SessionProvider>
        </BrowserRouter>
      </ConvexProvider>
    </StrictMode>,
  );
}
