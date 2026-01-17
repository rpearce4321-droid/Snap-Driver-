export default function Badge({children}:{children:string}){
  const tone = (s:string)=>{
    switch(s){
      case "approved": return "bg-green-600/20 text-green-300 border-green-600/30"
      case "rejected": return "bg-rose-600/20 text-rose-300 border-rose-600/30"
      case "suspended":return "bg-amber-600/20 text-amber-300 border-amber-600/30"
      case "pending":
      default:         return "bg-zinc-600/20 text-zinc-200 border-white/10"
    }
  }
  return <span className={`px-2 py-0.5 rounded border text-xs ${tone(String(children).toLowerCase())}`}>{children}</span>
}


