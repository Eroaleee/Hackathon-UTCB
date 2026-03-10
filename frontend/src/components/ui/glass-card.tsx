import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowing?: boolean;
  hover?: boolean;
}

export function GlassCard({
  children,
  className,
  glowing = false,
  hover = false,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass rounded-xl p-4",
        glowing && "glow-cyan",
        hover && "transition-all duration-300 hover:glow-cyan hover:border-primary/30",
        className
      )}
    >
      {children}
    </div>
  );
}
