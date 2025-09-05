
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
    const isChatInput = textarea.classList.contains("chat-input");
    
    if (isChatInput) {
        textarea.style.height = "auto";
        const newHeight = Math.min(textarea.scrollHeight, 96); // 96px is max-h-24
        textarea.style.height = `${newHeight}px`;
    } else {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }
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
        "min-h-[80px]", // Ensure it has a decent default height
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
