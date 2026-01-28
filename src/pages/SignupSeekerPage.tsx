// src/pages/SignupSeekerPage.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SeekerProfileForm } from "./SeekerPage";
import { createAccount, getAccountByEmail } from "../lib/accounts";
import { getSeekerById } from "../lib/data";
import { setSession } from "../lib/session";

export default function SignupSeekerPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"credentials" | "profile">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialProfile = useMemo(
    () => (email ? ({ email } as any) : undefined),
    [email]
  );

  const handleContinue = () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !/\S+@\S+\.[\S]+/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (getAccountByEmail(trimmed)) {
      setError("An account already exists for that email.");
      return;
    }
    setStep("profile");
  };

  const handleProfileSaved = (id?: string) => {
    if (!id) {
      setError("Profile saved, but no profile id was returned.");
      return;
    }
    const seeker = getSeekerById(id);
    if (!seeker) {
      setError("Profile could not be stored. Please retry or clear demo data.");
      return;
    }
    const finalEmail = (seeker as any)?.email || email.trim();
    try {
      createAccount({
        role: "SEEKER",
        email: finalEmail,
        password,
        seekerId: id,
      });
      window.localStorage.setItem("snapdriver_current_seeker_id", id);
      setSession({ role: "SEEKER", seekerId: id });
      navigate("/seekers");
    } catch (err: any) {
      setError(err?.message || "Unable to create account.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-xs uppercase tracking-wide text-slate-400 hover:text-slate-200"
        >
          Back to landing
        </button>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h1 className="text-2xl font-semibold">Seeker account signup</h1>
          <p className="text-sm text-slate-400 mt-2">
            Create credentials first, then complete the full Seeker profile. New
            profiles are saved as Pending.
          </p>
          <p className="text-sm text-emerald-200 mt-2">
            Build a visible reputation trail so retainers can trust your consistency before
            the first route even starts.
          </p>
        </div>

        {step === "credentials" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Step 1: Credentials
            </div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              name="seeker-email"
              type="email"
              autoComplete="email"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                name="seeker-password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 pr-14 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="relative">
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Confirm password"
                name="seeker-confirm"
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 pr-14 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {error && <div className="text-xs text-rose-300">{error}</div>}
            <button
              type="button"
              onClick={handleContinue}
              className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30 transition"
            >
              Continue to profile
            </button>
          </div>
        )}

        {step === "profile" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Step 2: Full profile
              </div>
              <div className="text-sm text-slate-400 mt-2">
                Use the same email you entered for credentials. Changing it will
                create a mismatch with your login.
              </div>
              {error && <div className="text-xs text-rose-300 mt-2">{error}</div>}
            </div>
            <SeekerProfileForm
              mode="create"
              initial={initialProfile}
              onSaved={handleProfileSaved}
            />
          </div>
        )}
      </div>
    </main>
  );
}
