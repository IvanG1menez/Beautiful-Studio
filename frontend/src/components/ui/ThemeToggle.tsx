"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-white backdrop-blur transition hover:bg-black/20",
        "dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/20",
        className,
      )}
      aria-label="Cambiar modo de tema"
    >
      <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-black/20 dark:bg-white/20">
        <Sun
          className={cn(
            "h-3 w-3 text-yellow-300 transition-opacity",
            theme === "light" ? "opacity-100" : "opacity-0",
          )}
        />
        <Moon
          className={cn(
            "absolute h-3 w-3 text-blue-100 transition-opacity",
            theme === "dark" ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
      <span className="font-medium tracking-wide">
        {theme === "dark" ? "Modo nocturno" : "Modo claro"}
      </span>
    </button>
  );
}
