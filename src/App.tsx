import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import LandingPage from "./pages/LandingPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import BadgesCatalogPage from "./pages/BadgesCatalogPage";
import SeekerPage from "./pages/SeekerPage";
import RetainerPage from "./pages/RetainerPage";
import SeekerDetailPage from "./pages/SeekerDetailPage";
import RetainerDetailPage from "./pages/RetainerDetailPage";
import SignupSeekerPage from "./pages/SignupSeekerPage";
import SignupRetainerPage from "./pages/SignupRetainerPage";
import { initServerSync, setSyncListener } from "./lib/serverSync";

export default function App() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    setSyncListener(() => {
      forceRender((v) => v + 1);
    });

    initServerSync();

    return () => {
      setSyncListener(null);
    };
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/seekers" element={<SeekerPage />} />
          <Route path="/seekers/:id" element={<SeekerDetailPage />} />
          <Route path="/retainers" element={<RetainerPage />} />
          <Route path="/retainers/:id" element={<RetainerDetailPage />} />
          <Route path="/signup/seeker" element={<SignupSeekerPage />} />
          <Route path="/signup/retainer" element={<SignupRetainerPage />} />
          <Route path="/badges" element={<BadgesCatalogPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
