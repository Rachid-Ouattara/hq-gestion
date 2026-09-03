import Skeleton from './Skeleton.jsx';

export default function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-3 p-5 lg:col-span-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="card space-y-3 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
