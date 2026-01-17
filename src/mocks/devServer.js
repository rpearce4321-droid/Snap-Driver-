export function register(app) {
  const seekers = Array.from({ length: 6 }).map((_, i) => ({
    id: i + 1,
    name: `Seeker ${i + 1}`,
    city: "City",
    state: "ST",
    zip: "00000",
    status: "pending",
  }))
  const retainers = Array.from({ length: 6 }).map((_, i) => ({
    id: i + 1,
    company: `Company ${i + 1}`,
    city: "Town",
    state: "ST",
    zip: "00000",
    status: "pending",
  }))

  app.get("/api/seekers", (_req, res) => res.end(JSON.stringify(seekers)))
  app.get("/api/retainers", (_req, res) => res.end(JSON.stringify(retainers)))
  app.get("/api/admin/stats", (_req, res) => {
    const stat = (list) => ({
      pending: list.filter((x) => x.status === "pending").length,
      approved: 0,
      rejected: 0,
      suspended: 0,
    })
    res.end(JSON.stringify({ seekers: stat(seekers), retainers: stat(retainers) }))
  })
}

