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
import WorkerTransaction from "./pages/WorkerTransaction"; // Import the new WorkerTransaction page
import { SessionContextProvider } from "./integrations/supabase/auth";
import React, { useEffect } from "react"; // Import useEffect

const queryClient = new QueryClient();

const App = () => {
  // Theme effect - apply theme from localStorage on initial load
  useEffect(() => {
    const storedTheme = (localStorage.getItem('theme') as 'light' | 'dark' | 'black') || 'light';
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'black');
    root.classList.add(storedTheme);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/workers" element={<Workers />} />
              <Route path="/scan-item" element={<ScanItem />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/record-takeout" element={<WorkerTransaction />} /> {/* Add the new WorkerTransaction route */}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SessionContextProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;