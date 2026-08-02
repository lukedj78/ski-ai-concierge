"use client";

import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "d") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Se sta scrivendo, "d" e' una lettera, non una scorciatoia.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resolvedTheme, setTheme]);

  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Cambia tema (attuale: ${isDark ? "scuro" : "chiaro"}). Scorciatoia: D`}
      title="Cambia tema — scorciatoia: D"
    >
      <HugeiconsIcon
        icon={isDark ? Sun03Icon : Moon02Icon}
        size={18}
        strokeWidth={1.8}
      />
    </Button>
  );
}
