import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Inventory from "./pages/Inventory";
import Workers from "./pages/Workers";
import ScanItem from "./pages/ScanItem";
import Settings from "./pages/Settings";
import WorkerTransaction from "./pages/WorkerTransaction";
import { SessionContextProvider } from "./integrations/supabase/auth";
import { I18nextProvider } from 'react-i18next'; // Import I18nextProvider
import i18n from './i18n'; // Import your i18n configuration

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <I18nextProvider i18n={i18n}> {/* Wrap with I18nextProvider */}
          <SessionContextProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/workers" element={<Workers />} />
              <Route path="/scan-item" element={<ScanItem />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/record-takeout" element={<WorkerTransaction />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SessionContextProvider>
        </I18nextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;