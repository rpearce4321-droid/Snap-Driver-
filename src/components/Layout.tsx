import { Outlet } from "react-router-dom"
import LeftNav from "./LeftNav"

export default function Layout() {
  return (
    <div className="min-h-screen text-zinc-100 bg-gradient-to-br from-[#0f172a] via-[#1e293b]/95 to-[#2b1b0e]/90 backdrop-blur-[2px]">
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-[auto,1fr] gap-6">
        <LeftNav />
        <main className="space-y-6">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Snap Driver</h1>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">MVP</span>
              <button className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Sign In</button>
            </div>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  )
}



