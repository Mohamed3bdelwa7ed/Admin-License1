import { Navigate, Route, Routes } from "react-router-dom";
import { currentAdmin } from "./api";
import { AppLayout } from "./components/AppLayout";
import { ThemeProvider } from "./components/Theme";
import { ToastProvider } from "./components/Toast";
import Activity from "./pages/Activity";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import LicenseDetails from "./pages/LicenseDetails";
import Licenses from "./pages/Licenses";
import Settings from "./pages/Settings";
import Login from "./pages/auth/Login";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!currentAdmin()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="licenses" element={<Licenses />} />
          <Route path="licenses/:id" element={<LicenseDetails />} />
          <Route path="customers" element={<Customers />} />
          <Route path="devices" element={<Devices />} />
          <Route path="activity" element={<Activity />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  </ThemeProvider>
  );
}
