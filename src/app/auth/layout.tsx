import type { ReactNode } from "react";
import { BarondaLogo } from "@/components/icons";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-md space-y-6 p-4">
        <div className="flex justify-center mb-6">
            <BarondaLogo className="h-16 w-auto" />
        </div>
        {children}
      </div>
    </div>
  );
}
