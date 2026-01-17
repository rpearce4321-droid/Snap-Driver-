import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function RQProvider({ children }: { children: ReactNode }) {
  // Lazy-create so dev HMR doesn't leak clients
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}


