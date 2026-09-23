import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="stack" style={{ padding: 16 }}>
      <div className="skeleton" style={{ height: 32, width: 192 }} />
      <div className="grid-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 96 }} />
        ))}
      </div>
      <div className="grid-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 160 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 256 }} />
    </div>
  );
}
