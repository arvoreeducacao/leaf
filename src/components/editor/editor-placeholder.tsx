import { PageIcon } from '@/components/icons'

type Props = Readonly<{
  documentId: string
  initialContent: string | null
  readOnly: boolean
}>

export function EditorPlaceholder({ initialContent, readOnly }: Props) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xlarge border border-alpha-100 bg-gray-50 px-4 py-10 text-center"
      data-slot="editor-placeholder"
    >
      <PageIcon aria-hidden="true" className="size-8 text-gray-600" />
      <p className="max-w-[440px] text-body-medium text-gray-700">
        Editor chegando na próxima onda
      </p>
      {readOnly ? (
        <p className="text-body-small text-gray-700">
          Você tem acesso somente de leitura a este documento
        </p>
      ) : null}
      {initialContent ? (
        <pre className="w-full overflow-x-auto text-left text-body-small text-gray-700">
          {initialContent}
        </pre>
      ) : null}
    </div>
  )
}
