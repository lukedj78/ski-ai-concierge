import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Skeleton className="h-14 w-full rounded-none" />
      <div className="mx-auto grid w-full max-w-[1280px] flex-1 gap-6 px-4 py-6 lg:grid-cols-[2fr_3fr] lg:px-12">
        <Skeleton className="h-60 w-full rounded-xl lg:h-full" />
        <Skeleton className="h-96 w-full rounded-lg lg:h-full" />
      </div>
      <Skeleton className="h-[72px] w-full rounded-none" />
    </div>
  );
}
