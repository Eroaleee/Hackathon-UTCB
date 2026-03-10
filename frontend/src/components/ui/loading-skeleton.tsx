import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({ className, lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className={cn("animate-pulse space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 rounded bg-surface-light",
            i === lines - 1 && "w-3/4"
          )}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("glass rounded-xl p-4 animate-pulse", className)}>
      <div className="h-4 w-1/3 rounded bg-surface-light mb-3" />
      <div className="space-y-2">
        <div className="h-3 rounded bg-surface-light" />
        <div className="h-3 rounded bg-surface-light" />
        <div className="h-3 w-2/3 rounded bg-surface-light" />
      </div>
      <div className="flex gap-2 mt-4">
        <div className="h-6 w-16 rounded-full bg-surface-light" />
        <div className="h-6 w-20 rounded-full bg-surface-light" />
      </div>
    </div>
  );
}

export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("glass rounded-xl animate-pulse flex items-center justify-center", className)}>
      <p className="text-sm text-muted-foreground">Se încarcă harta...</p>
    </div>
  );
}
