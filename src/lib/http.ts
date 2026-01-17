export async function getJSON<T=any>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return res.json()
}
export async function postJSON<T=any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(body) })
  if (!res.ok) {
    const text = await res.text().catch(()=> "")
    throw new Error(`POST ${url} -> ${res.status} ${text}`)
  }
  return res.json()
}


