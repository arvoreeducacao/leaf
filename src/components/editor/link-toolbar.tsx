'use client'

import {
  LinkToolbar,
  LinkToolbarController,
  useBlockNoteEditor,
  useEditorSelectionChange,
} from '@blocknote/react'
import type { LinkToolbarProps } from '@blocknote/react'
import { useCallback, useState } from 'react'

import { documentIdFromHref } from '@/lib/document-links'

import { DocLinkPreview } from './doc-link-preview'

function LeafLinkToolbar(props: LinkToolbarProps) {
  const editor = useBlockNoteEditor()
  const { from, to } = props.range

  const caretInside = useCallback(
    () =>
      editor.transact((transaction) => {
        const { selection } = transaction

        return (
          selection.empty && selection.anchor >= from && selection.anchor <= to
        )
      }),
    [editor, from, to],
  )

  const [editing, setEditing] = useState(caretInside)

  useEditorSelectionChange(
    useCallback(() => setEditing(caretInside()), [caretInside]),
    editor,
  )

  const origin =
    typeof window === 'undefined' ? undefined : window.location.origin
  const documentId = documentIdFromHref(props.url, origin)

  if (documentId === null || editing) {
    return <LinkToolbar {...props} />
  }

  return <DocLinkPreview documentId={documentId} />
}

const floatingUIOptions = {
  useFloatingOptions: { placement: 'bottom-start' as const },
}

export function LeafLinkToolbarController() {
  return (
    <LinkToolbarController
      floatingUIOptions={floatingUIOptions}
      linkToolbar={LeafLinkToolbar}
    />
  )
}
