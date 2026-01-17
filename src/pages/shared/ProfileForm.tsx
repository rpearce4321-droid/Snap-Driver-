import { useState } from "react"

export type Field = { name: string; label: string; type?: "text"|"number"|"date" }
export type CheckboxGroup = { name: string; label: string; options: string[] }

export default function ProfileForm({
  title, fields, checks, onSubmit
}:{
  title: string
  fields: Field[]
  checks?: CheckboxGroup[]
  onSubmit: (values: Record<string, any>) => Promise<void>|void
}) {
  const [msg, setMsg] = useState<string>("")
  const [pending, setPending] = useState(false)

  return (
    <form
      className="p-6 rounded-xl bg-zinc-900/60 border border-white/10 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const form = e.currentTarget as HTMLFormElement
        const fd = new FormData(form)
        // collect checkbox groups as arrays
        checks?.forEach(g => {
          const vals = fd.getAll(g.name).map(String)
          fd.delete(g.name)
          if (vals.length) fd.set(g.name, JSON.stringify(vals))
        })
        const raw = Object.fromEntries(fd.entries())
        // unpack the JSON-encoded arrays
        checks?.forEach(g => {
          if (raw[g.name]) try { raw[g.name] = JSON.parse(String(raw[g.name])) } catch { raw[g.name] = [] }
        })
        try {
          setPending(true); setMsg("")
          await onSubmit(raw)
          setMsg("Saved ?")
        } catch (err:any) {
          console.error(err)
          setMsg("Error saving")
        } finally {
          setPending(false)
        }
      }}
    >
      <h3 className="text-xl font-semibold">{title}</h3>

      <div className="grid md:grid-cols-2 gap-4">
        {fields.map(f => (
          <label key={f.name} className="space-y-1">
            <span className="text-sm text-zinc-300">{f.label}</span>
            <input
              name={f.name}
              type={f.type ?? "text"}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 outline-none focus:ring-2 ring-indigo-600"
              required={["name","company","ceo","city","state","zip"].includes(f.name)}
            />
          </label>
        ))}
      </div>

      {checks?.map(group => (
        <div key={group.name} className="space-y-2">
          <div className="text-sm text-zinc-300">{group.label}</div>
          <div className="flex flex-wrap gap-2">
            {group.options.map(opt => (
              <label key={opt} className="px-3 py-2 rounded-lg bg-zinc-800 border border-white/10">
                <input className="mr-2" type="checkbox" name={group.name} value={opt} />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}

      <button disabled={pending} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">
        {pending ? "Saving…" : "Save"}
      </button>
      {msg && <div className="text-sm mt-2">{msg}</div>}
    </form>
  )
}



