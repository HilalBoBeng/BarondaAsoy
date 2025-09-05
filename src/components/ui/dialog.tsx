
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer"

const Dialog = ({...props}) => {
    const isMobile = useIsMobile();
    if (isMobile) {
        return <Drawer {...props} />
    }
    return <DialogPrimitive.Root {...props} />
};

const DialogTrigger = ({...props}) => {
    const isMobile = useIsMobile();
    if (isMobile) {
        return <DrawerTrigger {...props}/>
    }
    return <DialogPrimitive.Trigger {...props} />
};

const DialogPortal = DialogPrimitive.Portal

const DialogClose = ({...props}) => {
    const isMobile = useIsMobile();
    if (isMobile) {
        return <DrawerClose {...props} />
    }
    return <DialogPrimitive.Close {...props} />
};

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
    const isMobile = useIsMobile();
    if (isMobile) {
        return (
            <DrawerContent ref={ref} className={className} {...props}>
                {children}
            </DrawerContent>
        )
    }

    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed left-[50%] top-[50%] z-50 grid w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
                "w-[90%] sm:max-w-lg rounded-lg max-h-[90dvh] flex flex-col",
                className
            )}
            {...props}
            >
            {children}
            <DrawerClose asChild>
                <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
             </DrawerClose>
            </DialogPrimitive.Content>
        </DialogPortal>
    )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
    const isMobile = useIsMobile();
    if (isMobile) {
        return <DrawerHeader className={className} {...props} />
    }
  return (
      <div
        className={cn(
          "flex flex-col space-y-1.5 p-6 pb-4 border-b shrink-0 text-center sm:text-left",
          className
        )}
        {...props}
      />
  )
}
DialogHeader.displayName = "DialogHeader"

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const isMobile = useIsMobile();
  if (isMobile) {
      return <DrawerBody className={cn("px-4", className)} {...props} />
  }
  return (
    <div className={cn("flex-1 overflow-y-auto p-6", className)} {...props} />
  )
}
DialogBody.displayName = "DialogBody"


const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const isMobile = useIsMobile();
  if (isMobile) {
      return <DrawerFooter className={className} {...props} />
  }
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-4 border-t shrink-0 bg-muted/50",
        className
      )}
      {...props}
    />
  )
}
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
    const isMobile = useIsMobile();
    if (isMobile) {
        return <DrawerTitle ref={ref} className={className} {...props} />
    }
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
})
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
    const isMobile = useIsMobile();
    if (isMobile) {
        return <DrawerDescription ref={ref} className={className} {...props} />
    }
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
