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
import WorkerReport from "./pages/WorkerReport"; // Import the new WorkerReport component
import { SessionContextProvider } from "./integrations/supabase/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import React, { useEffect } from "react";

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
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<NotFound />} />
              
              {/* Protected Routes */}
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
              <Route path="/workers" element={<ProtectedRoute><Workers /></ProtectedRoute>} />
              <Route path="/scan-item" element={<ProtectedRoute><ScanItem /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/record-takeout" element={<ProtectedRoute><WorkerTransaction /></ProtectedRoute>} />
              <Route path="/worker-report/:workerId" element={<ProtectedRoute><WorkerReport /></ProtectedRoute>} /> {/* New protected route */}
            </Routes>
          </SessionContextProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;