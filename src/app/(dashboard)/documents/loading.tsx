export default function DocumentsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-slate-200 rounded" />
          <div className="h-4 w-24 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-100 rounded" />
          <div className="h-9 w-28 bg-brand-100 rounded" />
        </div>
      </div>
      <div className="h-9 w-full bg-slate-100 rounded" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded" />
        ))}
      </div>
    </div>
  );
}
