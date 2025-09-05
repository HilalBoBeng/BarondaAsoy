
import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  const internalRef = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(ref, () => internalRef.current!);

  const handleInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 120); // 120px is max-h-30
    textarea.style.height = `${newHeight}px`;
  };

  React.useEffect(() => {
    if (internalRef.current) {
        handleInput({ currentTarget: internalRef.current } as React.FormEvent<HTMLTextAreaElement>);
    }
  }, [props.value]);

  return (
    <textarea
      className={cn(
        "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto",
        "min-h-[40px]", // A shorter default height for chat-like inputs
        className
      )}
      ref={internalRef}
      onInput={handleInput}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
