
import type { ReactNode } from "react";

export default function ScanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        {children}
    </div>
  );
}
