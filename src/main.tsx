import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContextProvider } from "./hooks/useSession.tsx";
import { SettingsProvider } from "./hooks/useSettings.tsx";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <SessionContextProvider>
          <App />
        </SessionContextProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>
);