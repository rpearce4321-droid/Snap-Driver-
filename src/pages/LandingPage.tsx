// src/pages/LandingPage.tsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  authenticateAccount,
  getAccountProfileId,
  type AccountRole,
} from "../lib/accounts";
import { setSession } from "../lib/session";

const DISPLAY_FONT = {
  fontFamily: '"Bebas Neue", "Oswald", "Arial Black", sans-serif',
};

const BODY_FONT = {
  fontFamily: '"Spline Sans", "Avenir Next", "Segoe UI", sans-serif',
};

type RoleCardProps = {
  role: AccountRole;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  signupHref: string;
};

const RoleCard: React.FC<RoleCardProps> = ({
  role,
  title,
  subtitle,
  description,
  accent,
  signupHref,
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
    <article className="group relative overflow-hidden rounded-[32px] border border-slate-800/70 bg-slate-950/80 p-6 shadow-[0_24px_80px_rgba(5,10,20,0.45)]">
      <div
        className="absolute -right-10 -top-12 h-40 w-40 rounded-full blur-[70px] opacity-70"
        style={{ background: accent }}
      />
      <div className="relative">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
          {role}
        </div>
        <h2 className="mt-2 text-3xl font-semibold text-slate-100" style={DISPLAY_FONT}>
          {title}
        </h2>
        <div className="mt-2 text-sm text-slate-400">{subtitle}</div>
        <p className="mt-4 text-sm text-slate-300 leading-relaxed">{description}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to={signupHref}
            className="rounded-full bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-900 transition hover:translate-y-[-1px]"
          >
            Yep, this is me
          </Link>
          <span className="text-xs text-slate-500">Creates a Pending profile</span>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Sign in
          </div>
          <div className="mt-3 space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              name={`${role}-email`}
              type="email"
              autoComplete="username"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                name={`${role}-password`}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 pr-14 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
              className="w-full rounded-full border border-slate-600/60 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default function LandingPage() {
  return (
    <main
      className="min-h-screen bg-[#0a0f18] text-slate-100 relative overflow-hidden"
      style={BODY_FONT as React.CSSProperties}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Spline+Sans:wght@300;400;500;600&display=swap');`}
      </style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),transparent_55%),radial-gradient(circle_at_20%_80%,_rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_80%_85%,_rgba(244,63,94,0.15),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.6),rgba(2,6,23,0.9))]" />

      <div className="relative max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.45em] text-slate-400">SnapDriver</div>
          <Link
            to="/admin"
            className="rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            Admin Login
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-6xl md:text-7xl leading-[0.9] text-slate-50" style={DISPLAY_FONT}>
              SnapDriver
            </h1>
            <p className="mt-4 text-xl text-emerald-200" style={DISPLAY_FONT}>
              Recruite on Reputation.
            </p>
          </div>
          <div className="max-w-md text-sm text-slate-300">
            The private logistics marketplace where dependable route history drives decisions. Seekers earn visible
            momentum, retainers hire with confidence, and every connection is rooted in proof.
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <RoleCard
            role="SEEKER"
            title="Seeker Path"
            subtitle="Turn your consistency into a public advantage."
            description="Show verified route performance, build a reputation trail, and get discovered for recurring work that matches your pace and priorities."
            accent="rgba(16,185,129,0.55)"
            signupHref="/signup/seeker"
          />
          <RoleCard
            role="RETAINER"
            title="Retainer Path"
            subtitle="Build a workforce around verified follow-through."
            description="See reliability signals at a glance, lock in dedicated routes, and reduce churn with a hiring lane that rewards commitment."
            accent="rgba(248,113,113,0.55)"
            signupHref="/signup/retainer"
          />
        </div>

        <div className="mt-10 grid gap-6">
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">How it works</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
              {[
                "Reputation-led route matching",
                "Dual approval for check-ins",
                "Dedicated routes with notice logic",
                "Pending approvals to protect quality",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
