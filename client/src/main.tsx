import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Initialize session persistence before anything else
import "./lib/session-persistence";

createRoot(document.getElementById("root")!).render(<App />);
