import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Keywords from "./pages/Keywords";
import Results from "./pages/Results";
import Trends from "./pages/Trends";
import Settings from "./pages/Settings";
import Usage from "./pages/Usage";
import Statistics from "./pages/Statistics";
import ScrapingLogicMap from "./pages/ScrapingLogicMap";
import AdminManagement from "./pages/AdminManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/keywords" element={
              <ProtectedRoute requireFeatures>
                <Keywords />
              </ProtectedRoute>
            } />
            <Route path="/results" element={
              <ProtectedRoute requireFeatures>
                <Results />
              </ProtectedRoute>
            } />
            <Route path="/trends" element={
              <ProtectedRoute>
                <Trends />
              </ProtectedRoute>
            } />
            <Route path="/statistics" element={
              <ProtectedRoute>
                <Statistics />
              </ProtectedRoute>
            } />
            <Route path="/scraping-logic" element={
              <ProtectedRoute>
                <ScrapingLogicMap />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute requireSettings>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/usage" element={
              <ProtectedRoute>
                <Usage />
              </ProtectedRoute>
            } />
            <Route path="/admin-management" element={
              <ProtectedRoute requireAdminManagement>
                <AdminManagement />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
