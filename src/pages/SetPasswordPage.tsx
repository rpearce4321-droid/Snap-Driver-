import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { consumeInvite } from "../lib/api";

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setStatus(null);
    if (!token) {
      setError("Missing invite token.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await consumeInvite({ token, password });
      setStatus("Password set. You can sign in now.");
      setPassword("");
      setConfirm("");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to set password.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-xs uppercase tracking-wide text-slate-400 hover:text-slate-200"
        >
          Back to landing
        </button>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h1 className="text-2xl font-semibold">Set your password</h1>
          <div className="space-y-3">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              {showPassword ? "Hide" : "Show"} password
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30 transition"
            >
              Set password
            </button>
            {status && <div className="text-xs text-emerald-200">{status}</div>}
            {error && <div className="text-xs text-rose-300">{error}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
