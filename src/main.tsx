import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import './i18n'; // Import the i18n configuration

createRoot(document.getElementById("root")!).render(<App />);