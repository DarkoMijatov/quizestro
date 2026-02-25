import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Theme is applied only inside the dashboard, not globally.
// Ensure public pages always start in light mode.
document.documentElement.classList.remove('dark');

createRoot(document.getElementById("root")!).render(<App />);
