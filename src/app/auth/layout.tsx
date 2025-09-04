
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showHomeButton = !pathname.startsWith('/auth/verify-admin-registration');

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/40 p-4">
      {showHomeButton && (
        <div className="absolute top-4 left-4">
            <Button variant="ghost" size="icon" asChild>
            <Link href="/">
                <Home className="h-5 w-5" />
                <span className="sr-only">Kembali ke Halaman Utama</span>
            </Link>
            </Button>
        </div>
      )}
      <div className="w-full max-w-md space-y-6">
        {children}
      </div>
    </div>
  );
}
