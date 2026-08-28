import type { TextStats } from './text-stats'

type Props = Readonly<{ stats: TextStats }>

function plural(count: number, singular: string, many: string) {
  return `${count} ${count === 1 ? singular : many}`
}

export function DocumentStats({ stats }: Props) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-caption text-gray-700">
      <span>{plural(stats.words, 'palavra', 'palavras')}</span>
      <span aria-hidden="true" className="text-gray-600">
        ·
      </span>
      <span>{plural(stats.characters, 'caractere', 'caracteres')}</span>
    </p>
  )
}
