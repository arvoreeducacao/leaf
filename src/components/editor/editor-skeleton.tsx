import { Skeleton } from '@/components/ui/skeleton'

export function EditorSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando o editor"
      className="flex w-full flex-col gap-3 px-8 py-4 tablet:px-14"
      role="status"
    >
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  )
}
