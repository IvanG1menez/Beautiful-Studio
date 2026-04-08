"use client";

import { cn } from "@/lib/utils";

interface BeautifulSpinnerProps {
  label?: string;
  className?: string;
}

export function BeautifulSpinner({ label = "Cargando...", className }: BeautifulSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <span className="absolute text-xs font-bold tracking-[0.2em] text-primary/80">
          BS
        </span>
      </div>
      {label && (
        <p className="text-xs text-muted-foreground">
          {label}
        </p>
      )}
    </div>
  );
}
