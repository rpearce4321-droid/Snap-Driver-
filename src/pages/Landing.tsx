export default function Landing() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="max-w-xl w-full p-8 text-center space-y-4">
        <h1 className="text-3xl font-bold">SnapDriver — Test Landing</h1>
        <p className="text-white/80">Quick links to role pages for testing.</p>
        <div className="flex gap-3 justify-center">
          <a className="rounded-2xl px-4 py-2 bg-white/10 hover:bg-white/20" href="/admin">Admin</a>
          <a className="rounded-2xl px-4 py-2 bg-white/10 hover:bg-white/20" href="/seekers">Seeker</a>
          <a className="rounded-2xl px-4 py-2 bg-white/10 hover:bg-white/20" href="/retainers">Retainer</a>
        </div>
      </div>
    </main>
  );
}


