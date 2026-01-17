// src/pages/LandingPage.tsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  authenticateAccount,
  getAccountProfileId,
  type AccountRole,
} from "../lib/accounts";
import { setSession } from "../lib/session";

const HERO_FONT = {
  fontFamily: '"Bodoni MT", "Didot", "Garamond", "Times New Roman", serif',
};

const BODY_FONT = {
  fontFamily: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif',
};

type AccessCardProps = {
  role: AccountRole;
  title: string;
  description: string;
  signupHref: string;
  accent: string;
};

const AccessCard: React.FC<AccessCardProps> = ({
  role,
  title,
  description,
  signupHref,
  accent,
}) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    setError(null);
    try {
      const account = authenticateAccount({ email, password, role });
      const profileId = getAccountProfileId(account);
      if (!profileId) throw new Error("Account has no linked profile.");
      if (role === "SEEKER") {
        window.localStorage.setItem("snapdriver_current_seeker_id", profileId);
        setSession({ role, seekerId: profileId });
      } else {
        window.localStorage.setItem("snapdriver_current_retainer_id", profileId);
        setSession({ role, retainerId: profileId });
      }
      navigate(role === "SEEKER" ? "/seekers" : "/retainers");
    } catch (err: any) {
      setError(err?.message || "Unable to sign in.");
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {role}
          </div>
          <h2 className="text-2xl font-semibold text-slate-100" style={HERO_FONT}>
            {title}
          </h2>
          <p className="text-sm text-slate-400 mt-2" style={BODY_FONT}>
            {description}
          </p>
        </div>
        <span
          className="h-10 w-10 rounded-2xl border border-slate-700 flex items-center justify-center text-lg"
          style={{ color: accent }}
        >
          ?
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Sign in
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <div className="relative">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
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
          onClick={handleLogin}
          className="w-full rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30 transition"
        >
          Sign in
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          New here? Complete the full signup.
        </div>
        <Link
          to={signupHref}
          className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 transition"
        >
          Create account
        </Link>
      </div>
    </div>
  );
};

export default function LandingPage() {
  return (
    <main
      className="min-h-screen bg-[#0b0f15] text-slate-100 relative overflow-hidden"
      style={BODY_FONT as React.CSSProperties}
    >
      <div className="absolute -top-32 right-[-10%] h-[360px] w-[360px] rounded-full bg-emerald-500/20 blur-[140px]" />
      <div className="absolute bottom-[-20%] left-[-10%] h-[420px] w-[420px] rounded-full bg-amber-500/10 blur-[160px]" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950/90 to-transparent" />

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">
              SnapDriver
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold mt-3" style={HERO_FONT}>
              A private logistics network,
              <span className="block text-emerald-200">built for trust-first routing.</span>
            </h1>
          </div>
          <div className="text-sm text-slate-400 max-w-md">
            Launch a new Seeker or Retainer account with full onboarding. Admin
            access stays open for testing and audits.
          </div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Why this matters
              </div>
              <div className="mt-3 text-sm text-slate-300">
                Make every route a clear commitment, keep check-ins simple, and
                keep the trust system honest. These signup flows mirror the real
                account experience and create Pending profiles.
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Full profile capture (not a stub)",
                  "Pending status for admin review",
                  "Email-based login ready for automation",
                  "Backdoor access preserved for QA",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-800/70 bg-slate-900/50 px-4 py-3 text-xs text-slate-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <div className="text-xs uppercase tracking-wide text-amber-300">
                Backdoor Access (Testing)
              </div>
              <div className="text-sm text-slate-400 mt-2">
                These shortcuts remain untouched for admin checks and rapid QA.
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 transition"
                  href="/admin"
                >
                  Admin (open)
                </a>
                <a
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 transition"
                  href="/seekers"
                >
                  Seeker backdoor
                </a>
                <a
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 transition"
                  href="/retainers"
                >
                  Retainer backdoor
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <AccessCard
              role="SEEKER"
              title="Seeker access"
              description="Create a full Seeker profile and sign in with your email. Pending profiles require admin approval."
              signupHref="/signup/seeker"
              accent="#5eead4"
            />
            <AccessCard
              role="RETAINER"
              title="Retainer access"
              description="Create a full Retainer profile with company details. Pending profiles require admin approval."
              signupHref="/signup/retainer"
              accent="#fbbf24"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
