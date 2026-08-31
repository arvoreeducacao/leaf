'use client'

import {
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  FileCaptionButton,
  FileReplaceButton,
  FormattingToolbar,
  FormattingToolbarController,
  NestBlockButton,
  TextAlignButton,
  UnnestBlockButton,
  useBlockNoteEditor,
  useComponentsContext,
} from '@blocknote/react'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { requestCommentOnBlock } from '@/components/comments/comments-bridge'
import { ChatIcon } from '@/components/icons'

function CommentButton() {
  const t = useTranslations('comments')
  const editor = useBlockNoteEditor()
  const components = useComponentsContext()

  if (!components) {
    return null
  }

  return (
    <components.FormattingToolbar.Button
      icon={<ChatIcon />}
      label={t('toolbarButton')}
      mainTooltip={t('toolbarButton')}
      onClick={() => {
        requestCommentOnBlock(editor.getTextCursorPosition().block.id)
      }}
    />
  )
}

function LeafFormattingToolbar({ canComment }: Readonly<{ canComment: boolean }>) {
  return (
    <FormattingToolbar>
      <BlockTypeSelect key="blockTypeSelect" />

      <FileCaptionButton key="fileCaptionButton" />
      <FileReplaceButton key="replaceFileButton" />

      <BasicTextStyleButton basicTextStyle="bold" key="boldStyleButton" />
      <BasicTextStyleButton basicTextStyle="italic" key="italicStyleButton" />
      <BasicTextStyleButton
        basicTextStyle="underline"
        key="underlineStyleButton"
      />
      <BasicTextStyleButton basicTextStyle="strike" key="strikeStyleButton" />
      <BasicTextStyleButton basicTextStyle="code" key="codeStyleButton" />

      <TextAlignButton key="textAlignLeftButton" textAlignment="left" />
      <TextAlignButton key="textAlignCenterButton" textAlignment="center" />
      <TextAlignButton key="textAlignRightButton" textAlignment="right" />

      <NestBlockButton key="nestBlockButton" />
      <UnnestBlockButton key="unnestBlockButton" />

      <CreateLinkButton key="createLinkButton" />

      {canComment ? <CommentButton key="commentButton" /> : null}
    </FormattingToolbar>
  )
}

export function LeafFormattingToolbarController({
  canComment,
}: Readonly<{ canComment: boolean }>) {
  const toolbar = useMemo(
    () =>
      function BoundFormattingToolbar() {
        return <LeafFormattingToolbar canComment={canComment} />
      },
    [canComment],
  )

  return <FormattingToolbarController formattingToolbar={toolbar} />
}
