// src/pages/AdminPage.tsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  US_STATES,
  VERTICALS,
  INSURANCE_TYPES,
  TRAITS,
  getSeekers,
  getRetainers,
  addSeekerForcePending,
  addRetainerForcePending,
  setSeekerStatusGuarded,
  setRetainerStatusGuarded,
  kpiSeekers,
  kpiRetainers,
  subscribe,
  purgeSeeker,
  purgeRetainer,
} from "../lib/data";
import type { Seeker, Retainer } from "../lib/data";
import { autoSeed } from "../lib/seed";
import { getServerSyncMode } from "../lib/serverSync";
import type { Conversation, ChatMessage } from "../lib/messages";
import {
  getAllConversations,
  getAllMessages,
  setMessageFlag,
} from "../lib/messages";

type KPIProps = {
  label: string;
  value: number | string;
  onClick?: () => void;
};

function KPI({ label, value, onClick }: KPIProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl p-4 text-left bg-white/5 hover:bg-white/10 border border-white/10 focus:outline-none focus:ring-4 focus:ring-blue-400/40"
    >
      <div className="text-xs uppercase tracking-wide text-white/60">
        {label}
      </div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </button>
  );
}

type Panel =
  | "dashboard"
  | "createSeeker"
  | "createRetainer"
  | "seekers:pending"
  | "seekers:approved"
  | "seekers:rejected"
  | "seekers:deleted"
  | "retainers:pending"
  | "retainers:approved"
  | "retainers:rejected"
  | "retainers:deleted"
  | "messageTraffic";

export default function AdminPage() {
  const navigate = useNavigate();

  const [seekers, setSeekers] = useState<Seeker[]>(getSeekers());
  const [retainers, setRetainers] = useState<Retainer[]>(getRetainers());

  useEffect(() => {
    // Subscribe to local data changes
    const unsub = subscribe(() => {
      setSeekers(getSeekers());
      setRetainers(getRetainers());
    });
    return unsub;
  }, []);

  // KPI helper objects (each field is a function)
  const sk = kpiSeekers;
  const rt = kpiRetainers;

  const seekersPending = seekers.filter((s) => s.status === "PENDING");
  const seekersApproved = seekers.filter((s) => s.status === "APPROVED");
  const seekersRejected = seekers.filter((s) => s.status === "REJECTED");
  const seekersDeleted = seekers.filter((s) => s.status === "DELETED");

  const retainersPending = retainers.filter((r) => r.status === "PENDING");
  const retainersApproved = retainers.filter((r) => r.status === "APPROVED");
  const retainersRejected = retainers.filter((r) => r.status === "REJECTED");
  const retainersDeleted = retainers.filter((r) => r.status === "DELETED");

  const [panel, setPanel] = useState<Panel>("dashboard");

  const panelLabelMap: Record<Panel, string> = {
    dashboard: "Dashboard",
    createSeeker: "Create Seeker",
    createRetainer: "Create Retainer",
    "seekers:pending": "Seekers - Pending",
    "seekers:approved": "Seekers - Approved",
    "seekers:rejected": "Seekers - Rejected",
    "seekers:deleted": "Seekers - Deleted",
    "retainers:pending": "Retainers - Pending",
    "retainers:approved": "Retainers - Approved",
    "retainers:rejected": "Retainers - Rejected",
    "retainers:deleted": "Retainers - Deleted",
    messageTraffic: "Message Traffic",
  };

  const panelGroups: { label: string; items: { label: string; value: Panel }[] }[] = [
    {
      label: "Admin",
      items: [
        { label: "Dashboard", value: "dashboard" },
        { label: "Create Seeker", value: "createSeeker" },
        { label: "Create Retainer", value: "createRetainer" },
      ],
    },
    {
      label: "Seekers",
      items: [
        { label: "Pending", value: "seekers:pending" },
        { label: "Approved", value: "seekers:approved" },
        { label: "Rejected", value: "seekers:rejected" },
        { label: "Deleted", value: "seekers:deleted" },
      ],
    },
    {
      label: "Retainers",
      items: [
        { label: "Pending", value: "retainers:pending" },
        { label: "Approved", value: "retainers:approved" },
        { label: "Rejected", value: "retainers:rejected" },
        { label: "Deleted", value: "retainers:deleted" },
      ],
    },
    {
      label: "Messaging",
      items: [{ label: "Message Traffic", value: "messageTraffic" }],
    },
  ];

  const activePanelLabel = panelLabelMap[panel];

  const [sf, setSf] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    birthday: "",
    city: "",
    state: "FL",
    zip: "",
    yearsInBusiness: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    insuranceType: INSURANCE_TYPES[0],
    deliveryVerticals: [] as string[],
    references: [] as {
      name: string;
      phone?: string;
      email?: string;
      company?: string;
    }[],
  });

  const [rf, setRf] = useState({
    companyName: "",
    ceoName: "",
    city: "",
    state: "FL",
    zip: "",
    mission: "",
    yearsInBusiness: "",
    employees: "",
    deliveryVerticals: [] as string[],
    desiredTraits: [] as string[],
  });

  function handleSeedDemo() {
    autoSeed({ seekers: 5, retainers: 5, force: true });
    setSeekers(getSeekers());
    setRetainers(getRetainers());
  }

  function handleCreateSeeker(e: React.FormEvent) {
    e.preventDefault();
    if (!sf.firstName.trim() || !sf.lastName.trim()) return;

    const id = addSeekerForcePending({
      firstName: sf.firstName.trim(),
      lastName: sf.lastName.trim(),
      companyName: sf.companyName || undefined,
      birthday: sf.birthday || undefined,
      city: sf.city || undefined,
      state: sf.state || undefined,
      zip: sf.zip || undefined,
      yearsInBusiness: sf.yearsInBusiness
        ? Number(sf.yearsInBusiness)
        : undefined,
      deliveryVerticals: sf.deliveryVerticals,
      vehicleYear: sf.vehicleYear || undefined,
      vehicleMake: sf.vehicleMake || undefined,
      vehicleModel: sf.vehicleModel || undefined,
      insuranceType: sf.insuranceType || undefined,
      references: sf.references,
      createdAt: new Date().toISOString(),
      role: "SEEKER",
      status: "PENDING",
    } as any);

    setSf({
      firstName: "",
      lastName: "",
      companyName: "",
      birthday: "",
      city: "",
      state: "FL",
      zip: "",
      yearsInBusiness: "",
      vehicleYear: "",
      vehicleMake: "",
      vehicleModel: "",
      insuranceType: INSURANCE_TYPES[0],
      deliveryVerticals: [],
      references: [],
    });

    navigate(`/seekers/${id}`);
  }

  function handleCreateRetainer(e: React.FormEvent) {
    e.preventDefault();
    if (!rf.companyName.trim()) return;

    const id = addRetainerForcePending({
      companyName: rf.companyName.trim(),
      ceoName: rf.ceoName || undefined,
      city: rf.city || undefined,
      state: rf.state || undefined,
      zip: rf.zip || undefined,
      mission: rf.mission || undefined,
      yearsInBusiness: rf.yearsInBusiness
        ? Number(rf.yearsInBusiness)
        : undefined,
      employees: rf.employees ? Number(rf.employees) : undefined,
      deliveryVerticals: rf.deliveryVerticals,
      desiredTraits: rf.desiredTraits,
      createdAt: new Date().toISOString(),
      role: "RETAINER",
      status: "PENDING",
    } as any);

    setRf({
      companyName: "",
      ceoName: "",
      city: "",
      state: "FL",
      zip: "",
      mission: "",
      yearsInBusiness: "",
      employees: "",
      deliveryVerticals: [],
      desiredTraits: [],
    });

    navigate(`/retainers/${id}`);
  }

  // Always allow reset + reseed from Admin (except production server mode)
  const showSeedButton = getServerSyncMode() !== "server";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col lg:flex-row overflow-x-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 border-r border-white/10 bg-gradient-to-b from-gray-950 to-gray-900/70">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
            Admin
          </div>
          <div className="flex gap-2">
            <Link className="btn" to="/seekers">
              Seekers
            </Link>
            <Link className="btn" to="/retainers">
              Retainers
            </Link>
          </div>
        </div>

        <nav className="p-3 space-y-4">
          <div className="space-y-2">
            <button
              onClick={() => setPanel("dashboard")}
              className={
                "w-full rounded-xl px-3 py-2 transition " +
                (panel === "dashboard"
                  ? "bg-white/15 border border-white/20"
                  : "bg-white/5 hover:bg-white/10 border border-transparent")
              }
            >
              Dashboard
            </button>
            <div className="h-px bg-white/10" />
          </div>

          {/* SEEKERS */}
          <section>
            <div className="text-xs uppercase tracking-wider text-white/60 px-1 mb-2">
              Seekers
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setPanel("createSeeker")}
                className={
                  "w-full rounded-xl px-3 py-2 transition " +
                  (panel === "createSeeker"
                    ? "bg-white/15 border border-white/20"
                    : "bg-white/5 hover:bg-white/10 border border-transparent")
                }
              >
                Create Seeker
              </button>
              <button
                onClick={() => setPanel("seekers:pending")}
                className="w-full rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10"
              >
                Pending
              </button>
              <button
                onClick={() => setPanel("seekers:approved")}
                className="w-full rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10"
              >
                Approved
              </button>
              <button
                onClick={() => setPanel("seekers:rejected")}
                className="w-full rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10"
              >
                Rejected
              </button>
              <button
                onClick={() => setPanel("seekers:deleted")}
                className="w-full rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10"
              >
                Deleted
              </button>
            </div>
          </section>

          <div className="h-px bg-white/10" />

          {/* RETAINERS */}
          <section>
            <div className="text-xs uppercase tracking-wider text-white/60 px-1 mb-2">
              Retainers
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setPanel("createRetainer")}
                className={
                  "w-full rounded-xl px-3 py-2 transition " +
                  (panel === "createRetainer"
                    ? "bg-white/15 border border-white/20"
                    : "bg-white/5 hover:bg-white/10 border border-transparent")
                }
              >
                Create Retainer
              </button>
              <button
                onClick={() => setPanel("retainers:pending")}
                className="w-full rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10"
              >
                Pending
              </button>
              <button
                onClick={() => setPanel("retainers:approved")}
                className="w-full rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10"
              >
                Approved
              </button>
              <button
                onClick={() => setPanel("retainers:rejected")}
                className="w-full rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10"
              >
                Rejected
              </button>
              <button
                onClick={() => setPanel("retainers:deleted")}
                className="w-full rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10"
              >
                Deleted
              </button>
            </div>
          </section>

          <div className="h-px bg-white/10" />

          {/* Messaging */}
          <section>
            <div className="text-xs uppercase tracking-wider text-white/60 px-1 mb-2">
              Messaging
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setPanel("messageTraffic")}
                className={
                  "w-full rounded-xl px-3 py-2 transition " +
                  (panel === "messageTraffic"
                    ? "bg-white/15 border border-white/20"
                    : "bg-white/5 hover:bg-white/10 border border-transparent")
                }
              >
                Message Traffic
              </button>
            </div>
          </section>
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col">
        <div className="lg:hidden border-b border-white/10 bg-gray-950/80 backdrop-blur">
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/60">Admin</div>
                <div className="text-lg font-semibold">Snap Driver</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-white/60">Panel</div>
                <div className="text-sm font-semibold text-white">{activePanelLabel}</div>
              </div>
            </div>

            {seekers.length === 0 && retainers.length === 0 && (
              <p className="text-xs text-white/60">
                No data in storage. Use "Reset + Seed Demo Data" to load sample profiles.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {showSeedButton && (
                <button
                  className="btn w-full sm:w-auto"
                  type="button"
                  onClick={() => {
                    if (seekers.length > 0 || retainers.length > 0) {
                      const ok = window.confirm(
                        "This will wipe existing demo data and reseed 75 seekers + 15 retainers. Continue?"
                      );
                      if (!ok) return;
                    }
                    handleSeedDemo();
                  }}
                >
                  Reset + Seed Demo Data
                </button>
              )}
              <Link className="btn" to="/seekers">
                Seeker Dashboard
              </Link>
              <Link className="btn" to="/retainers">
                Retainer Dashboard
              </Link>
            </div>

            <div className="space-y-3">
              {panelGroups.map((group) => (
                <div key={group.label}>
                  <div className="text-[10px] uppercase tracking-wider text-white/60 mb-2">
                    {group.label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <MobileTabButton
                        key={`${group.label}-${item.value}`}
                        label={item.label}
                        active={panel === item.value}
                        onClick={() => setPanel(item.value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4">
              <div className="surface p-3 rounded-2xl">
                <div className="text-sm text-white/70 mb-2">Seekers</div>
                <div className="grid grid-cols-2 gap-3">
                  <KPI
                    label="Pending"
                    value={sk.pending()}
                    onClick={() => setPanel("seekers:pending")}
                  />
                  <KPI
                    label="Approved"
                    value={sk.approved()}
                    onClick={() => setPanel("seekers:approved")}
                  />
                  <KPI
                    label="Rejected"
                    value={sk.rejected()}
                    onClick={() => setPanel("seekers:rejected")}
                  />
                  <KPI
                    label="Deleted"
                    value={sk.deleted()}
                    onClick={() => setPanel("seekers:deleted")}
                  />
                </div>
              </div>
              <div className="surface p-3 rounded-2xl">
                <div className="text-sm text-white/70 mb-2">Retainers</div>
                <div className="grid grid-cols-2 gap-3">
                  <KPI
                    label="Pending"
                    value={rt.pending()}
                    onClick={() => setPanel("retainers:pending")}
                  />
                  <KPI
                    label="Approved"
                    value={rt.approved()}
                    onClick={() => setPanel("retainers:approved")}
                  />
                  <KPI
                    label="Rejected"
                    value={rt.rejected()}
                    onClick={() => setPanel("retainers:rejected")}
                  />
                  <KPI
                    label="Deleted"
                    value={rt.deleted()}
                    onClick={() => setPanel("retainers:deleted")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <header className="hidden lg:block px-6 py-4 border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Admin</h1>
              {/* Optional: hint when nothing is in storage */}
              {seekers.length === 0 && retainers.length === 0 && (
                <p className="text-xs text-white/60 mt-1">
                  No data in storage. Click &quot;Reset + Seed Demo Data&quot; to
                  load sample profiles.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {showSeedButton && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    // If there is already data, ask before nuking & reseeding
                    if (seekers.length > 0 || retainers.length > 0) {
                      const ok = window.confirm(
                        "This will wipe existing demo data and reseed 75 seekers + 15 retainers. Continue?"
                      );
                      if (!ok) return;
                    }
                    handleSeedDemo();
                  }}
                >
                  Reset + Seed Demo Data
                </button>
              )}

              <nav className="flex gap-2">
                <Link className="btn" to="/seekers">
                  Seeker Dashboard
                </Link>
                <Link className="btn" to="/retainers">
                  Retainer Dashboard
                </Link>
              </nav>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="surface p-3 rounded-2xl">
              <div className="text-sm text-white/70 mb-2">Seekers</div>
              <div className="grid grid-cols-2 gap-3">
                <KPI
                  label="Pending"
                  value={sk.pending()}
                  onClick={() => setPanel("seekers:pending")}
                />
                <KPI
                  label="Approved"
                  value={sk.approved()}
                  onClick={() => setPanel("seekers:approved")}
                />
                <KPI
                  label="Rejected"
                  value={sk.rejected()}
                  onClick={() => setPanel("seekers:rejected")}
                />
                <KPI
                  label="Deleted"
                  value={sk.deleted()}
                  onClick={() => setPanel("seekers:deleted")}
                />
              </div>
            </div>
            <div className="surface p-3 rounded-2xl">
              <div className="text-sm text-white/70 mb-2">Retainers</div>
              <div className="grid grid-cols-2 gap-3">
                <KPI
                  label="Pending"
                  value={rt.pending()}
                  onClick={() => setPanel("retainers:pending")}
                />
                <KPI
                  label="Approved"
                  value={rt.approved()}
                  onClick={() => setPanel("retainers:approved")}
                />
                <KPI
                  label="Rejected"
                  value={rt.rejected()}
                  onClick={() => setPanel("retainers:rejected")}
                />
                <KPI
                  label="Deleted"
                  value={rt.deleted()}
                  onClick={() => setPanel("retainers:deleted")}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard pending lists */}
        {panel === "dashboard" && (
          <main className="p-4 lg:p-6 grid md:grid-cols-2 gap-6">
            <section className="surface p-5 hover:border-blue-500/30 transition">
              <h2 className="text-xl font-semibold mb-4">Pending Seekers</h2>
              <PendingSeekersList seekers={seekersPending} />
            </section>
            <section className="surface p-5 hover:border-blue-500/30 transition">
              <h2 className="text-xl font-semibold mb-4">Pending Retainers</h2>
              <PendingRetainersList retainers={retainersPending} />
            </section>
          </main>
        )}

        {/* Create Seeker */}
        {panel === "createSeeker" && (
          <main className="p-4 lg:p-6">
            <section className="surface p-5 max-w-4xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Create Seeker</h2>
                <button className="btn" onClick={() => setPanel("dashboard")}>
                  Back to Dashboard
                </button>
              </div>
              <form
                onSubmit={handleCreateSeeker}
                className="grid sm:grid-cols-2 gap-3"
              >
                <label>
                  <div className="text-sm text-white/80 mb-1">First Name *</div>
                  <input
                    value={sf.firstName}
                    onChange={(e) =>
                      setSf({ ...sf, firstName: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    required
                  />
                </label>
                <label>
                  <div className="text-sm text-white/80 mb-1">Last Name *</div>
                  <input
                    value={sf.lastName}
                    onChange={(e) =>
                      setSf({ ...sf, lastName: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    required
                  />
                </label>
                <label className="sm:col-span-2">
                  <div className="text-sm text-white/80 mb-1">Company (DBA)</div>
                  <input
                    value={sf.companyName}
                    onChange={(e) =>
                      setSf({ ...sf, companyName: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                  />
                </label>
                <label>
                  <div className="text-sm text-white/80 mb-1">Birthday</div>
                  <input
                    type="date"
                    value={sf.birthday}
                    onChange={(e) =>
                      setSf({ ...sf, birthday: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                  />
                </label>
                <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                  <label>
                    <div className="text-sm text-white/80 mb-1">City</div>
                    <input
                      value={sf.city}
                      onChange={(e) =>
                        setSf({ ...sf, city: e.target.value })
                      }
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    />
                  </label>
                  <label>
                    <div className="text-sm text-white/80 mb-1">State</div>
                    <select
                      value={sf.state}
                      onChange={(e) =>
                        setSf({ ...sf, state: e.target.value })
                      }
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    >
                      {US_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <div className="text-sm text-white/80 mb-1">ZIP</div>
                    <input
                      value={sf.zip}
                      onChange={(e) =>
                        setSf({ ...sf, zip: e.target.value })
                      }
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    />
                  </label>
                </div>
                <label>
                  <div className="text-sm text-white/80 mb-1">
                    Years in Business
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={sf.yearsInBusiness}
                    onChange={(e) =>
                      setSf({ ...sf, yearsInBusiness: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                  />
                </label>
                <label>
                  <div className="text-sm text-white/80 mb-1">
                    Insurance Type
                  </div>
                  <select
                    value={sf.insuranceType}
                    onChange={(e) =>
                      setSf({ ...sf, insuranceType: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                  >
                    {INSURANCE_TYPES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <div className="text-sm text-white/80 mb-1">
                    Delivery Verticals
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {VERTICALS.map((v) => (
                      <label
                        key={v}
                        className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={sf.deliveryVerticals.includes(v)}
                          onChange={() => {
                            const has = sf.deliveryVerticals.includes(v);
                            setSf({
                              ...sf,
                              deliveryVerticals: has
                                ? sf.deliveryVerticals.filter((x) => x !== v)
                                : [...sf.deliveryVerticals, v],
                            });
                          }}
                        />
                        <span>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 sm:col-span-2">
                  <label>
                    <div className="text-sm text-white/80 mb-1">
                      Vehicle Year
                    </div>
                    <input
                      value={sf.vehicleYear}
                      onChange={(e) =>
                        setSf({ ...sf, vehicleYear: e.target.value })
                      }
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    />
                  </label>
                  <label>
                    <div className="text-sm text-white/80 mb-1">
                      Vehicle Make
                    </div>
                    <input
                      value={sf.vehicleMake}
                      onChange={(e) =>
                        setSf({ ...sf, vehicleMake: e.target.value })
                      }
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    />
                  </label>
                  <label>
                    <div className="text-sm text-white/80 mb-1">
                      Vehicle Model
                    </div>
                    <input
                      value={sf.vehicleModel}
                      onChange={(e) =>
                        setSf({ ...sf, vehicleModel: e.target.value })
                      }
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    />
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-sm text-white/80 mb-1">
                    Reference (Name)
                  </div>
                  <input
                    onChange={(e) =>
                      setSf({ ...sf, references: [{ name: e.target.value }] })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    placeholder="First Last"
                  />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button className="btn" type="submit">
                    Save Seeker
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setSf({
                        firstName: "",
                        lastName: "",
                        companyName: "",
                        birthday: "",
                        city: "",
                        state: "FL",
                        zip: "",
                        yearsInBusiness: "",
                        vehicleYear: "",
                        vehicleMake: "",
                        vehicleModel: "",
                        insuranceType: INSURANCE_TYPES[0],
                        deliveryVerticals: [],
                        references: [],
                      })
                    }
                  >
                    Clear
                  </button>
                </div>
              </form>
            </section>
          </main>
        )}

        {/* Create Retainer */}
        {panel === "createRetainer" && (
          <main className="p-4 lg:p-6">
            <section className="surface p-5 max-w-4xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Create Retainer</h2>
                <button className="btn" onClick={() => setPanel("dashboard")}>
                  Back to Dashboard
                </button>
              </div>
              <form
                onSubmit={handleCreateRetainer}
                className="grid sm:grid-cols-2 gap-3"
              >
                <label className="sm:col-span-2">
                  <div className="text-sm text-white/80 mb-1">
                    Company Name *
                  </div>
                  <input
                    value={rf.companyName}
                    onChange={(e) =>
                      setRf({ ...rf, companyName: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    required
                  />
                </label>
                <label>
                  <div className="text-sm text-white/80 mb-1">CEO Name</div>
                  <input
                    value={rf.ceoName}
                    onChange={(e) =>
                      setRf({ ...rf, ceoName: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                  />
                </label>
                <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                  <label>
                    <div className="text-sm text-white/80 mb-1">City</div>
                    <input
                      value={rf.city}
                      onChange={(e) =>
                        setRf({ ...rf, city: e.target.value })
                      }
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    />
                  </label>
                  <label>
                    <div className="text-sm text-white/80 mb-1">State</div>
                    <select
                      value={rf.state}
                      onChange={(e) =>
                        setRf({ ...rf, state: e.target.value })
                      }
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    >
                      {US_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <div className="text-sm text-white/80 mb-1">ZIP</div>
                    <input
                      value={rf.zip}
                      onChange={(e) =>
                        setRf({ ...rf, zip: e.target.value })
                      }
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                    />
                  </label>
                </div>
                <label className="sm:col-span-2">
                  <div className="text-sm text-white/80 mb-1">
                    Mission Statement
                  </div>
                  <textarea
                    value={rf.mission}
                    onChange={(e) =>
                      setRf({ ...rf, mission: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 min-h-[84px]"
                  />
                </label>
                <label>
                  <div className="text-sm text-white/80 mb-1">
                    Years in Business
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={rf.yearsInBusiness}
                    onChange={(e) =>
                      setRf({ ...rf, yearsInBusiness: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                  />
                </label>
                <label>
                  <div className="text-sm text-white/80 mb-1">Employees</div>
                  <input
                    type="number"
                    min="0"
                    value={rf.employees}
                    onChange={(e) =>
                      setRf({ ...rf, employees: e.target.value })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                  />
                </label>
                <div className="sm:col-span-2">
                  <div className="text-sm text-white/80 mb-1">
                    Delivery Verticals
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {VERTICALS.map((v) => (
                      <label
                        key={v}
                        className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={rf.deliveryVerticals.includes(v)}
                          onChange={() => {
                            const has = rf.deliveryVerticals.includes(v);
                            setRf({
                              ...rf,
                              deliveryVerticals: has
                                ? rf.deliveryVerticals.filter((x) => x !== v)
                                : [...rf.deliveryVerticals, v],
                            });
                          }}
                        />
                        <span>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-sm text-white/80 mb-1">
                    Desired Driver Traits
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {TRAITS.map((t) => (
                      <label
                        key={t}
                        className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={rf.desiredTraits.includes(t)}
                          onChange={() => {
                            const has = rf.desiredTraits.includes(t);
                            setRf({
                              ...rf,
                              desiredTraits: has
                                ? rf.desiredTraits.filter((x) => x !== t)
                                : [...rf.desiredTraits, t],
                            });
                          }}
                        />
                        <span>{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button className="btn" type="submit">
                    Save Retainer
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setRf({
                        companyName: "",
                        ceoName: "",
                        city: "",
                        state: "FL",
                        zip: "",
                        mission: "",
                        yearsInBusiness: "",
                        employees: "",
                        deliveryVerticals: [],
                        desiredTraits: [],
                      })
                    }
                  >
                    Clear
                  </button>
                </div>
              </form>
            </section>
          </main>
        )}

        {/* Seekers status views */}
        {panel.startsWith("seekers:") && (
          <main className="p-4 lg:p-6">
            <section className="surface p-5 hover:border-blue-500/30 transition">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Seekers — {panel.split(":")[1]}
                </h2>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => setPanel("dashboard")}>
                    Back to Dashboard
                  </button>
                  {panel !== "seekers:deleted" && (
                    <div className="hidden md:flex gap-2">
                      <button
                        className="btn"
                        onClick={() =>
                          seekers.forEach((s) =>
                            setSeekerStatusGuarded(s.id, "DELETED")
                          )
                        }
                      >
                        Mark All Deleted
                      </button>
                      <button
                        className="btn"
                        onClick={() =>
                          seekers.forEach((s) =>
                            setSeekerStatusGuarded(s.id, "REJECTED")
                          )
                        }
                      >
                        Mark All Rejected
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {panel === "seekers:pending" && (
                <SD_List items={seekersPending} role="SEEKER" />
              )}
              {panel === "seekers:approved" && (
                <SD_List items={seekersApproved} role="SEEKER" />
              )}
              {panel === "seekers:rejected" && (
                <SD_List items={seekersRejected} role="SEEKER" />
              )}
              {panel === "seekers:deleted" && (
                <SD_DeletedList
                  items={seekersDeleted}
                  role="SEEKER"
                  onPurge={(id) => {
                    purgeSeeker(id);
                    setSeekers((prev) => prev.filter((s) => s.id !== id));
                  }}
                />
              )}
            </section>
          </main>
        )}

        {/* Retainers status views */}
        {panel.startsWith("retainers:") && (
          <main className="p-4 lg:p-6">
            <section className="surface p-5 hover:border-blue-500/30 transition">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Retainers — {panel.split(":")[1]}
                </h2>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => setPanel("dashboard")}>
                    Back to Dashboard
                  </button>
                  {panel !== "retainers:deleted" && (
                    <div className="hidden md:flex gap-2">
                      <button
                        className="btn"
                        onClick={() =>
                          retainers.forEach((r) =>
                            setRetainerStatusGuarded(r.id, "DELETED")
                          )
                        }
                      >
                        Mark All Deleted
                      </button>
                      <button
                        className="btn"
                        onClick={() =>
                          retainers.forEach((r) =>
                            setRetainerStatusGuarded(r.id, "REJECTED")
                          )
                        }
                      >
                        Mark All Rejected
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {panel === "retainers:pending" && (
                <SD_List items={retainersPending} role="RETAINER" />
              )}
              {panel === "retainers:approved" && (
                <SD_List items={retainersApproved} role="RETAINER" />
              )}
              {panel === "retainers:rejected" && (
                <SD_List items={retainersRejected} role="RETAINER" />
              )}
              {panel === "retainers:deleted" && (
                <SD_DeletedList
                  items={retainersDeleted}
                  role="RETAINER"
                  onPurge={(id) => {
                    purgeRetainer(id);
                    setRetainers((prev) => prev.filter((r) => r.id !== id));
                  }}
                />
              )}
            </section>
          </main>
        )}

        {/* Admin message traffic */}
        {panel === "messageTraffic" && (
          <main className="p-4 lg:p-6">
            <AdminMessageTraffic />
          </main>
        )}
      </div>
    </div>
  );
}

/* ===== Pending cards on Dashboard ===== */

const PendingSeekersList: React.FC<{ seekers: any[] }> = ({ seekers }) => (
  <ul className="space-y-2">
    {seekers.length > 0 ? (
      seekers.map((s) => (
        <li key={s.id}>
          <div
            onClick={(e) => {
              const t = e.target as HTMLElement;
              if (
                t.closest(
                  '[data-stop],button,[role="button"],a,input,select,textarea'
                )
              )
                return;
              window.location.href = `/seekers/${s.id}`;
            }}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.location.href = `/seekers/${s.id}`;
              }
            }}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between hover:bg-white/10 hover:ring-2 hover:ring-indigo-500 cursor-pointer"
          >
            <Link to={`/seekers/${s.id}`} className="flex-1 pr-3 block">
              <div className="font-medium">
                {s.firstName} {s.lastName}
              </div>
              <div className="text-white/60 text-sm">
                {s.city ?? "—"}, {s.state ?? "—"} • {s.email ?? "—"}
              </div>
            </Link>
            <div className="flex items-center gap-2" data-stop>
              <button
                className="btn"
                onClick={() => setSeekerStatusGuarded(s.id, "APPROVED")}
              >
                Approve
              </button>
              <button
                className="btn"
                onClick={() => setSeekerStatusGuarded(s.id, "REJECTED")}
              >
                Reject
              </button>
            </div>
          </div>
        </li>
      ))
    ) : (
      <li className="text-white/60">No pending seekers.</li>
    )}
  </ul>
);

const PendingRetainersList: React.FC<{
  retainers: any[];
}> = ({ retainers }) => (
  <ul className="space-y-2">
    {retainers.length > 0 ? (
      retainers.map((r) => (
        <li key={r.id}>
          <div
            onClick={(e) => {
              const t = e.target as HTMLElement;
              if (
                t.closest(
                  '[data-stop],button,[role="button"],a,input,select,textarea'
                )
              )
                return;
              window.location.href = `/retainers/${r.id}`;
            }}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.location.href = `/retainers/${r.id}`;
              }
            }}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between hover:bg-white/10 hover:ring-2 hover:ring-indigo-500 cursor-pointer"
          >
            <Link to={`/retainers/${r.id}`} className="flex-1 pr-3 block">
              <div className="font-medium">{r.companyName}</div>
              <div className="text-white/60 text-sm">
                {r.city ?? "—"}, {r.state ?? "—"} • {r.email ?? "—"}
              </div>
            </Link>
            <div className="flex items-center gap-2" data-stop>
              <button
                className="btn"
                onClick={() => setRetainerStatusGuarded(r.id, "APPROVED")}
              >
                Approve
              </button>
              <button
                className="btn"
                onClick={() => setRetainerStatusGuarded(r.id, "REJECTED")}
              >
                Reject
              </button>
            </div>
          </div>
        </li>
      ))
    ) : (
      <li className="text-white/60">No pending retainers.</li>
    )}
  </ul>
);

/* ===== Shared list for non-deleted views ===== */

function SD_List({
  items,
  role,
}: {
  items: (Seeker | Retainer)[];
  role: "SEEKER" | "RETAINER";
}) {
  if (!items || items.length === 0) {
    return <div className="text-white/60">No records.</div>;
  }

  return (
    <ul className="space-y-2">
      {items.map((it: any) => (
        <li key={it.id}>
          <div
            className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 hover:bg-white/10 hover:ring-2 hover:ring-indigo-500 cursor-pointer"
            onClick={(e) => {
              const t = e.target as HTMLElement;
              if (
                t.closest(
                  '[data-stop],button,[role="button"],a,input,select,textarea'
                )
              )
                return;
              window.location.href =
                role === "SEEKER" ? `/seekers/${it.id}` : `/retainers/${it.id}`;
            }}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.location.href =
                  role === "SEEKER"
                    ? `/seekers/${it.id}`
                    : `/retainers/${it.id}`;
              }
            }}
          >
            <div>
              {role === "SEEKER" ? (
                <>
                  <span className="font-medium">
                    {it.firstName} {it.lastName}
                  </span>
                  <span className="text-white/60">
                    {" "}
                    • {it.city ?? "—"}, {it.state ?? "—"}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium">{it.companyName}</span>
                  <span className="text-white/60">
                    {" "}
                    • {it.city ?? "—"}, {it.state ?? "—"}
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-2" data-stop>
              <a
                className="btn"
                href={
                  role === "SEEKER" ? `/seekers/${it.id}` : `/retainers/${it.id}`
                }
              >
                Open
              </a>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ===== Deleted list with Permanently Delete ===== */

function SD_DeletedList({
  items,
  role,
  onPurge,
}: {
  items: (Seeker | Retainer)[];
  role: "SEEKER" | "RETAINER";
  onPurge: (id: string) => void;
}) {
  if (!items || items.length === 0) {
    return <div className="text-white/60">No records.</div>;
  }

  return (
    <ul className="space-y-2">
      {items.map((it: any) => (
        <li key={it.id}>
          <div
            className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 hover:bg-white/10 hover:ring-2 hover:ring-red-500 cursor-pointer"
            onClick={(e) => {
              const t = e.target as HTMLElement;
              if (
                t.closest(
                  '[data-stop],button,[role="button"],a,input,select,textarea'
                )
              )
                return;
              window.location.href =
                role === "SEEKER" ? `/seekers/${it.id}` : `/retainers/${it.id}`;
            }}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.location.href =
                  role === "SEEKER"
                    ? `/seekers/${it.id}`
                    : `/retainers/${it.id}`;
              }
            }}
          >
            <div>
              {role === "SEEKER" ? (
                <>
                  <span className="font-medium">
                    {it.firstName} {it.lastName}
                  </span>
                  <span className="text-white/60">
                    {" "}
                    • {it.city ?? "—"}, {it.state ?? "—"}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium">{it.companyName}</span>
                  <span className="text-white/60">
                    {" "}
                    • {it.city ?? "—"}, {it.state ?? "—"}
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-2" data-stop>
              <a
                className="btn"
                href={
                  role === "SEEKER" ? `/seekers/${it.id}` : `/retainers/${it.id}`
                }
              >
                Open
              </a>
              <button
                type="button"
                className="btn bg-red-600/80 hover:bg-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onPurge(it.id);
                }}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}


/* ------------------------------------------------------------------ */
/* Mobile tab button                                                  */
/* ------------------------------------------------------------------ */

const MobileTabButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 px-3 py-1.5 rounded-full text-xs border transition",
        active
          ? "bg-blue-400/20 text-blue-200 border-blue-400/40"
          : "bg-white/5 text-white/80 border-white/10 hover:text-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
};

/* ===== Admin Message Traffic ===== */

type MessageTrafficFilter = "ALL" | "FLAGGED" | "UNFLAGGED";
type MessageWithContext = ChatMessage & { conversation: Conversation };

const AdminMessageTraffic: React.FC = () => {
  const [messages, setMessages] = useState<MessageWithContext[]>([]);
  const [filter, setFilter] = useState<MessageTrafficFilter>("ALL");

  const reload = () => {
    const convs = getAllConversations();
    const convById = new Map(convs.map((c) => [c.id, c]));
    const allMsgs = getAllMessages();

    const withContext: MessageWithContext[] = allMsgs
      .map((m) => {
        const conv = convById.get(m.conversationId);
        if (!conv) return null;
        return { ...m, conversation: conv } as MessageWithContext;
      })
      .filter((x): x is MessageWithContext => x !== null);

    setMessages(withContext);
  };

  useEffect(() => {
    reload();
  }, []);

  const handleFlagChange = (id: string, flag: string) => {
    setMessageFlag(id, flag);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, flag: flag || undefined } : m))
    );
  };

  const filtered = messages.filter((m) => {
    if (filter === "FLAGGED") return !!m.flag;
    if (filter === "UNFLAGGED") return !m.flag;
    return true;
  });

  return (
    <section className="surface p-5 hover:border-blue-500/30 transition">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h2 className="text-xl font-semibold">Message Traffic</h2>
          <p className="text-sm text-white/60">
            All Seeker ↔ Retainer conversations. Use flags to triage and
            moderate issues before they escalate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as MessageTrafficFilter)
            }
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-sm"
          >
            <option value="ALL">All messages</option>
            <option value="FLAGGED">Flagged only</option>
            <option value="UNFLAGGED">Unflagged only</option>
          </select>
          <button type="button" className="btn" onClick={reload}>
            Refresh
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-white/60 text-sm">
          No messages match the current filter.
        </div>
      ) : (
        <ul className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {filtered.map((msg) => (
            <AdminMessageRow
              key={msg.id}
              msg={msg}
              onFlagChange={handleFlagChange}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

const AdminMessageRow: React.FC<{
  msg: MessageWithContext;
  onFlagChange: (id: string, flag: string) => void;
}> = ({ msg, onFlagChange }) => {
  const { conversation: conv } = msg;

  // Pull current profiles from the same store used by the rest of Admin
  const allSeekers = getSeekers();
  const allRetainers = getRetainers();

  // Try several ways to match: id, userId (if present), etc.
  const seeker =
    conv.seekerId &&
    (allSeekers.find(
      (s: any) => String(s.id) === String(conv.seekerId)
    ) ||
      allSeekers.find(
        (s: any) => String((s as any).userId ?? "") === String(conv.seekerId)
      ));

  const retainer =
    conv.retainerId &&
    (allRetainers.find(
      (r: any) => String(r.id) === String(conv.retainerId)
    ) ||
      allRetainers.find(
        (r: any) =>
          String((r as any).userId ?? "") === String(conv.retainerId)
      ));

  const seekerName =
    seeker &&
    (([seeker.firstName, seeker.lastName].filter(Boolean).join(" ")) ||
      (seeker as any).name ||
      (seeker as any).companyName);

  const retainerName =
    retainer &&
    ((retainer as any).companyName || (retainer as any).name || null);

  const senderName =
    msg.senderRole === "SEEKER"
      ? seekerName ||
        (conv.seekerId
          ? `Seeker (${conv.seekerId})`
          : "Seeker (no profile found)")
      : retainerName ||
        (conv.retainerId
          ? `Retainer (${conv.retainerId})`
          : "Retainer (no profile found)");

  const recipientName =
    msg.senderRole === "SEEKER"
      ? retainerName ||
        (conv.retainerId
          ? `Retainer (${conv.retainerId})`
          : "Retainer (no profile found)")
      : seekerName ||
        (conv.seekerId
          ? `Seeker (${conv.seekerId})`
          : "Seeker (no profile found)");

  const createdAt = new Date(msg.createdAt);
  const when = Number.isNaN(createdAt.getTime())
    ? msg.createdAt
    : createdAt.toLocaleString();

  const subject = conv.subject || "(no subject)";
  const flagValue = msg.flag || "";

  return (
    <li className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-semibold">{senderName}</span>
          <span className="text-white/50 text-xs ml-2">
            ({msg.senderRole === "SEEKER" ? "Seeker" : "Retainer"})
          </span>
          <span className="text-white/60 text-xs mx-2">&rarr;</span>
          <span className="text-sm text-white/80">{recipientName}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg bg-white/5 border border-white/15 px-2 py-1 text-xs"
            value={flagValue}
            onChange={(e) => onFlagChange(msg.id, e.target.value)}
          >
            <option value="">No Flag</option>
            <option value="FLAGGED">Flagged</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="HOLD">Hold</option>
          </select>
          <span className="text-[11px] text-white/50 whitespace-nowrap">
            {when}
          </span>
        </div>
      </div>
      <div className="text-xs text-white/60">
        <span className="font-semibold text-white/80">Subject:</span>{" "}
        {subject}
      </div>
      <div className="text-sm text-white/80 whitespace-pre-wrap">
        {msg.body}
      </div>
      {/* Temporary debug line so we can verify IDs are wired correctly */}
      <div className="text-[11px] text-white/35 mt-1">
        Conv: {conv.id} · SeekerId: {conv.seekerId || "—"} · RetainerId:{" "}
        {conv.retainerId || "—"}
      </div>
    </li>
  );
};

