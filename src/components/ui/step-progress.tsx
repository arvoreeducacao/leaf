import { cn } from '@/shared/utils'

type StepProgressProps = {
  total: number
  current: number
  className?: string
}

function StepProgress({
  total,
  current,
  className,
}: Readonly<StepProgressProps>) {
  return (
    <div
      aria-label={`Etapa ${current + 1} de ${total}`}
      aria-valuemax={total}
      aria-valuemin={1}
      aria-valuenow={current + 1}
      className={cn('flex items-center gap-2', className)}
      role="progressbar"
    >
      {Array.from({ length: total }, (_, i) => `step-${i}`).map(
        (stepKey, i) => {
          const isActive = i === current
          const isPast = i < current
          return (
            <span
              className={cn(
                'h-2 rounded-pill transition-all duration-200',
                isActive ? 'w-5 bg-primary' : 'w-2',
                isPast ? 'bg-primary' : !isActive && 'bg-gray-200'
              )}
              key={stepKey}
            />
          )
        }
      )}
    </div>
  )
}

export type { StepProgressProps }
export { StepProgress }
