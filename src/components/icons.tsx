import type { SVGProps } from "react";

export function BarondaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <div className="flex items-center gap-2" {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 text-primary"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span className="text-lg font-bold text-primary group-data-[collapsible=icon]:hidden">
        Baronda
      </span>
    </div>
  );
}
