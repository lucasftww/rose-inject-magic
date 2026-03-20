import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initErrorTracker } from "./lib/errorTracker";

// Inicia monitoramento de erros antes de renderizar
initErrorTracker();

createRoot(document.getElementById("root")!).render(<App />);
