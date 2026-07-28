import { createRoot } from "react-dom/client";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getStoredToken } from "./lib/auth-token";
import App from "./App";
import "./index.css";

setBaseUrl(import.meta.env.VITE_API_URL ?? null);

// Cross-origin session cookies can be blocked by browser third-party-cookie
// policies, so every request also carries the stored session token (if any)
// as an Authorization header — see lib/auth-token.ts for details.
setAuthTokenGetter(() => getStoredToken());

createRoot(document.getElementById("root")!).render(<App />);
