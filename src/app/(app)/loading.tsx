import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-8 tablet:px-8 tablet:py-10">
      <span className="sr-only" role="status">
        Carregando
      </span>
      <Skeleton className="h-10 w-full max-w-[360px]" />
      <div className="mx-auto flex w-full max-w-prose-leaf flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full max-w-[520px]" />
        <Skeleton className="h-4 w-full max-w-[440px]" />
      </div>
    </div>
  )
}
