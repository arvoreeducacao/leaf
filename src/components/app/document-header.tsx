'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { DocumentMenu } from '@/components/app/document-menu'
import {
  documentTitleInputId,
  requestEditorFocus,
} from '@/components/editor/focus-bridge'
import { ShareButton } from '@/components/sharing/share-button'
import { renameDocument } from '@/lib/document-actions'

type Props = Readonly<{
  documentId: string
  title: string
  canEdit: boolean
  isOwner: boolean
}>

export function DocumentHeader({
  documentId,
  title,
  canEdit,
  isOwner,
}: Props) {
  const titleId = documentTitleInputId
  const [value, setValue] = useState(title)
  const [saving, setSaving] = useState(false)
  const lastSaved = useRef(title)
  const loadedFor = useRef(documentId)

  useEffect(() => {
    if (loadedFor.current === documentId) {
      return
    }

    loadedFor.current = documentId
    setValue(title)
    lastSaved.current = title
  }, [documentId, title])

  async function persist() {
    const next = value.trim()

    if (next === lastSaved.current) {
      return
    }

    setSaving(true)
    const result = await renameDocument(documentId, next)
    setSaving(false)

    if (result.ok) {
      lastSaved.current = next.length > 0 ? next : 'Sem título'
      setValue(lastSaved.current)
    } else {
      setValue(lastSaved.current)
      toast.error(result.error)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        {canEdit ? (
          <h1 className="min-w-0">
            <label className="sr-only" htmlFor={titleId}>
              Título do documento
            </label>
            <input
              className="w-full rounded-large border border-alpha-200 bg-transparent px-2 py-1 font-bold text-display-small text-gray-900 outline-none transition-colors hover:border-gray-600 focus-visible:border-gray-900 focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2"
              disabled={saving}
              id={titleId}
              onBlur={persist}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                  requestEditorFocus()
                }

                if (event.key === 'Escape') {
                  setValue(lastSaved.current)
                  event.currentTarget.blur()
                }
              }}
              value={value}
            />
            <span aria-live="polite" className="sr-only">
              {saving ? 'Salvando título' : ''}
            </span>
          </h1>
        ) : (
          <h1 className="px-2 py-1 font-bold text-display-small text-gray-900">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ShareButton canShare={isOwner} documentId={documentId} />
        <DocumentMenu documentId={documentId} isOwner={isOwner} />
      </div>
    </div>
  )
}
