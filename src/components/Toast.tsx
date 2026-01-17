import React, { createContext, useCallback, useContext, useState } from "react"

type Toast = { id: number; message: string }
const Ctx = createContext<{ addToast: (m:string)=>void }|null>(null)

export function ToastProvider({children}:{children:React.ReactNode}){
  const [list, setList] = useState<Toast[]>([])
  const addToast = useCallback((message:string)=>{
    const id = Date.now()+Math.random()
    setList(x=>[...x, {id, message}])
    setTimeout(()=> setList(x=>x.filter(t=>t.id!==id)), 2500)
  },[])
  return (
    <Ctx.Provider value={{ addToast }}>
      {children}
      <div className="fixed right-4 bottom-4 space-y-2 z-50">
        {list.map(t=>(
          <div key={t.id} className="px-4 py-3 rounded-lg bg-zinc-900/90 border border-white/10 shadow-lg">
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
export function useToast(){
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}


