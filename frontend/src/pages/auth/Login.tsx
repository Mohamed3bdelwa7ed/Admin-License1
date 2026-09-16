import { Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../api";
import { Button } from "../../components/Button";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const expired = new URLSearchParams(window.location.search).has("expired");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-night-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600 text-xl font-bold text-white">
            M
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-green-50">Madar License</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-green-100/50">Sign in to the admin panel</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-green-100/10 dark:bg-night-900"
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-gray-700 dark:text-green-100/80">
                Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 dark:text-green-100/40" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@madar.example"
                  className="h-9.5 w-full rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-green-50 dark:placeholder:text-green-100/30 dark:focus:border-primary-400 dark:focus:ring-primary-500/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-gray-700 dark:text-green-100/80">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 dark:text-green-100/40" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9.5 w-full rounded-md border border-gray-300 bg-white pr-3 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-green-50 dark:placeholder:text-green-100/30 dark:focus:border-primary-400 dark:focus:ring-primary-500/20"
                />
              </div>
            </div>

            {expired && !error && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                Your session expired. Please sign in again.
              </p>
            )}
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400 dark:text-green-100/40">
            Demo: admin@madar.example / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
