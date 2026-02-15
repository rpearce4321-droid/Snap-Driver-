// src/pages/LandingPage.tsx
import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  authenticateAccount,
  getAccountProfileId,
  type AccountRole,
} from "../lib/accounts";
import { getRetainers, getSeekers } from "../lib/data";
import { setSession } from "../lib/session";
import { pullFromServer, pauseServerSync, isServerAuthoritative } from "../lib/serverSync";
import { login, resetPassword, lookupProfile, register } from "../lib/api";

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
  valuePoints: string[];
  ctaLabel: string;
  accent: string;
  signupHref: string;
};

const RoleCard: React.FC<RoleCardProps> = ({
  role,
  title,
  subtitle,
  valuePoints,
  ctaLabel,
  accent,
  signupHref,
}) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const handleLogin = async () => {
    setError(null);
    setResetStatus(null);
    setResetLink(null);
    const rawEmail = (emailRef.current?.value ?? email).trim();
    const normEmail = rawEmail.toLowerCase();
    const pwd = passwordRef.current?.value ?? password;
    const allowLocalFallback = !isServerAuthoritative();
    try {
      pauseServerSync(4000);
      await login({ email: normEmail, password: pwd });
      try {
        await pullFromServer();
      } catch {
        // ignore pull errors
      }

      let resolvedId = null;
      if (role === "SEEKER") {
        const seeker = getSeekers().find((s) => String((s as any).email ?? "").toLowerCase() === normEmail);
        resolvedId = seeker?.id ?? null;
      } else {
        const retainer = getRetainers().find((r) => String((r as any).email ?? "").toLowerCase() === normEmail);
        resolvedId = retainer?.id ?? null;
      }

      if (!resolvedId) {
        const resolved = await lookupProfile({ email: normEmail, role });
        resolvedId = resolved.id ?? null;
      }

      if (!resolvedId) {
        throw new Error("Account has no linked profile.");
      }

      if (role === "SEEKER") {
        window.localStorage.setItem("snapdriver_current_seeker_id", resolvedId);
        setSession({ role, seekerId: resolvedId, email: normEmail });
      } else {
        window.localStorage.setItem("snapdriver_current_retainer_id", resolvedId);
        setSession({ role, retainerId: resolvedId, email: normEmail });
      }

      navigate(role === "SEEKER" ? "/seekers" : "/retainers");
      return;
    } catch (err: any) {
      // If a profile exists but no user account was created yet, provision one now.
      try {
        if (normEmail && pwd) {
          const resolved = await lookupProfile({ email: normEmail, role });
          if (resolved?.id) {
            await register({ email: normEmail, password: pwd, role });
            if (role === "SEEKER") {
              window.localStorage.setItem("snapdriver_current_seeker_id", resolved.id);
              setSession({ role, seekerId: resolved.id, email: normEmail });
            } else {
              window.localStorage.setItem("snapdriver_current_retainer_id", resolved.id);
              setSession({ role, retainerId: resolved.id, email: normEmail });
            }
            try {
              await pullFromServer();
              pauseServerSync(4000);
            } catch {
              // ignore pull errors
            }
            navigate(role === "SEEKER" ? "/seekers" : "/retainers");
            return;
          }
        }
      } catch {
        // ignore register fallback
      }
      if (allowLocalFallback) {
        try {
          const account = authenticateAccount({ email: normEmail, password: pwd, role });
          const profileId = getAccountProfileId(account);
          if (!profileId) throw new Error("Account has no linked profile.");
          if (role === "SEEKER") {
            window.localStorage.setItem("snapdriver_current_seeker_id", profileId);
            setSession({ role, seekerId: profileId, email: normEmail });
          } else {
            window.localStorage.setItem("snapdriver_current_retainer_id", profileId);
            setSession({ role, retainerId: profileId, email: normEmail });
          }
          navigate(role === "SEEKER" ? "/seekers" : "/retainers");
          return;
        } catch (localErr: any) {
          setError(localErr?.message || err?.response?.data?.error || "Unable to sign in.");
          return;
        }
      }
      setError(err?.response?.data?.error || "Unable to sign in.");
    }
  };

  const handleReset = async () => {
    setError(null);
    setResetStatus(null);
    setResetLink(null);
    const resetEmail = (emailRef.current?.value ?? email).trim();
    if (!resetEmail) {
      setError("Enter your email to reset.");
      return;
    }
    try {
      const res = await resetPassword({ email: resetEmail });
      setResetLink(res.magicLink);
      setResetStatus(`Reset link created. Expires ${new Date(res.expiresAt).toLocaleString()}.`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to create reset link.");
    }
  };

  const handleCopyReset = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink);
      setResetStatus("Reset link copied.");
    } catch {
      setResetStatus("Reset link ready to copy.");
    }
  };

  return (
    <article className="group relative overflow-hidden rounded-[32px] border border-slate-800/70 bg-slate-950/80 p-6 shadow-[0_24px_80px_rgba(5,10,20,0.45)]">
      <div
        className="absolute -right-10 -top-12 h-40 w-40 rounded-full blur-[70px] opacity-70"
        style={{ background: accent }}
      />
      <div className="relative">
        <h2 className="text-3xl font-semibold text-slate-100 text-center" style={DISPLAY_FONT}>
          {title}
        </h2>
        <div className="mt-2 text-sm text-slate-400 text-center">{subtitle}</div>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {valuePoints.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-2"
            >
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to={signupHref}
            className="rounded-full bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-900 transition hover:translate-y-[-1px]"
          >
            {ctaLabel}
          </Link>
          <span className="text-xs text-slate-500">Creates a Pending profile</span>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 text-center">
            Sign in
          </div>
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <input
              ref={emailRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              name={`${role}-email`}
              type="email"
              autoComplete={`section-${role.toLowerCase()} username`}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <div className="relative">
              <input
                ref={passwordRef}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                name={`${role}-password`}
                autoComplete={`section-${role.toLowerCase()} current-password`}
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
            <div className="flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                onClick={handleReset}
                className="hover:text-slate-200"
              >
                Forgot password?
              </button>
              {resetLink && (
                <button
                  type="button"
                  onClick={handleCopyReset}
                  className="hover:text-slate-200"
                >
                  Copy reset link
                </button>
              )}
            </div>
            {resetStatus && <div className="text-xs text-emerald-300">{resetStatus}</div>}
            {error && <div className="text-xs text-rose-300">{error}</div>}
            <button
              type="submit"
              className="w-full rounded-full border border-slate-600/60 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </article>
  );
};

export default function LandingPage() {
  const instantValue = [
    "Two clear roles: Retainers retain, Seekers deliver. Expectations start aligned.",
    "Validated route history turns performance into proof.",
    "Interview, decide, and confirm start dates without the runaround.",
    "Dual approval check-ins protect both sides.",
    "Reputation compounds instead of resetting every route.",
  ];

  const platformPillars = [
    "Profile confirmations with document storage to support compliance.",
    "Search and matching tuned for 1099 delivery workflows.",
    "Reputation scoring that rewards consistency and follow-through.",
    "Admin review that supports marketplace quality at scale.",
  ];

  const marketplaceFixes = [
    {
      title: "Built for 1099 delivery",
      body: "No diluted applicant pools. No generic job board noise.",
    },
    {
      title: "Built for real operators",
      body: "Replace anonymous listings with validated profiles and real operating context.",
    },
    {
      title: "Designed for repeat routes",
      body: "Focus on dependable coverage, not one-off dispatch work.",
    },
    {
      title: "Faster placement",
      body: "Match for fit early so both parties stop wasting time.",
    },
  ];

  const coreSystems = [
    "Profile confirmations, badges, and reputation trails.",
    "Secure messaging and interview scheduling.",
    "Document storage for compliance and readiness.",
    "Ratings with dispute handling and audit trails.",
    "Admin approvals that protect marketplace quality.",
    "Video marketing to showcase real operators.",
  ];

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
        <div className="flex items-center justify-end gap-4 text-xs text-slate-100">
          <Link to="/mission" className="hover:text-white transition">
            Mission
          </Link>
          <Link to="/how-it-works" className="hover:text-white transition">
            How it works
          </Link>
          <Link
            to="/admin"
            className="hover:text-white transition"
          >
            Admin Login
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-6xl md:text-7xl leading-[0.9] text-slate-50" style={DISPLAY_FONT}>
              SnapDriver
            </h1>
            <p className="mt-4 text-xl text-emerald-200" style={DISPLAY_FONT}>
              Reputation built on real experience.
            </p>
            <div className="mt-5 space-y-1 text-sm text-slate-300">
              <div>Verify the work.</div>
              <div>Protect the routes.</div>
              <div>Reward the follow-through.</div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/seeker-path"
                className="rounded-full border border-slate-200/40 bg-slate-100 text-slate-900 px-5 py-2 text-xs font-semibold hover:translate-y-[-1px] transition"
              >
                Seeker Path
              </Link>
              <Link
                to="/retainer-path"
                className="rounded-full border border-slate-700 bg-slate-950/70 px-5 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-900 transition"
              >
                Retainer Path
              </Link>
            </div>
          </div>
          <div className="max-w-md text-sm text-slate-300 space-y-3">
            <div className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
              Mission Statement
            </div>
            <p>
              SnapDriver turns validated route performance into a shared reputation layer that protects quality,
              rewards follow-through, and builds trusted logistics partnerships.
            </p>
            <p>
              We are a platform for advertising, promoting, seeking, and retaining 1099 delivery services - not a
              broker, not a dispatcher, and not a middleman.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <RoleCard
            role="SEEKER"
            title="Seeker Path"
            subtitle="Independent contract drivers seeking consistent route partnerships."
            valuePoints={[
              "Build a public reputation trail anchored in mutual check-ins.",
              "Get discovered for routes that fit your pace and priorities.",
              "Earn repeatable work instead of starting over every gig.",
            ]}
            ctaLabel="Become a seeker now"
            accent="rgba(16,185,129,0.55)"
            signupHref="/signup/seeker"
          />
          <RoleCard
            role="RETAINER"
            title="Retainer Path"
            subtitle="Route owners who need dependable independent drivers for consistent work."
            valuePoints={[
              "Select with proof, not promises.",
              "Fill routes faster with seekers who already fit.",
              "Reduce churn by rewarding consistent follow-through.",
            ]}
            ctaLabel="Become a retainer now"
            accent="rgba(248,113,113,0.55)"
            signupHref="/signup/retainer"
          />
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Why SnapDriver</div>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              SnapDriver was built by people who lived the 1099 delivery chaos. Recycled listings, vague expectations,
              and day-one ghosting created a churn loop that hurts both sides. We built a marketplace that replaces
              that noise with validated context, clear standards, and a reputation system that compounds over time.
            </p>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              This platform is built for professional independent contractors and the route owners who rely on them.
              The goal is simple: reduce churn, protect quality, and make strong partnerships easier to form and keep.
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Value created instantly</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {instantValue.map((item) => (
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

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Built for 1099 delivery</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
              {marketplaceFixes.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3"
                >
                  <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-300">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Platform pillars</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {platformPillars.map((item) => (
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

        <div className="mt-10 rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-500">Core systems</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
            {coreSystems.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6">
          <div className="rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.35em] text-slate-500">How it works</div>
              <Link
                to="/how-it-works"
                className="text-xs text-emerald-200 hover:text-emerald-100 transition"
              >
                View full workflow
              </Link>
            </div>
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

        <div className="mt-10 rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-6 text-xs text-slate-400">
          SnapDriver provides marketplace tools and messaging for independent contractors and route owners. SnapDriver
          does not employ, supervise, or control Seekers, does not dispatch routes, and does not broker services. Each
          party is responsible for their own compliance, taxes, insurance, and agreements.
        </div>

        <footer className="mt-6 border-t border-slate-800/70 pt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div>Copyright (c) 2026 SnapDriver. All rights reserved.</div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/mission" className="hover:text-slate-200 transition">
              Mission
            </Link>
            <Link to="/how-it-works" className="hover:text-slate-200 transition">
              How it works
            </Link>
            <Link to="/privacy" className="hover:text-slate-200 transition">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-slate-200 transition">
              Terms of Service
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
