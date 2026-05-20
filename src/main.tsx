import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { FantasyProvider } from "./store/fantasyStore";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <FantasyProvider>
        <App />
      </FantasyProvider>
    </BrowserRouter>
  </StrictMode>,
);
