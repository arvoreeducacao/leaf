'use client'

import { FormattingToolbarExtension } from '@blocknote/core/extensions'
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
  useExtension,
} from '@blocknote/react'
import { AIExtension, useAIDictionary } from '@blocknote/xl-ai'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { requestCommentOnBlock } from '@/components/comments/comments-bridge'
import { ChatIcon, MagicWandIcon } from '@/components/icons'

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

function AiButton() {
  const dictionary = useAIDictionary()
  const editor = useBlockNoteEditor()
  const components = useComponentsContext()
  const ai = useExtension(AIExtension)
  const formattingToolbar = useExtension(FormattingToolbarExtension)

  if (!components) {
    return null
  }

  return (
    <components.FormattingToolbar.Button
      icon={<MagicWandIcon />}
      label={dictionary.formatting_toolbar.ai.tooltip}
      mainTooltip={dictionary.formatting_toolbar.ai.tooltip}
      onClick={() => {
        const selection = editor.getSelection()
        const target =
          selection?.blocks.at(-1) ?? editor.getTextCursorPosition().block

        ai.openAIMenuAtBlock(target.id)
        formattingToolbar.store.setState(false)
      }}
    />
  )
}

function LeafFormattingToolbar({
  canComment,
  canUseAi,
}: Readonly<{ canComment: boolean; canUseAi: boolean }>) {
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

      {canUseAi ? <AiButton key="aiButton" /> : null}

      {canComment ? <CommentButton key="commentButton" /> : null}
    </FormattingToolbar>
  )
}

export function LeafFormattingToolbarController({
  canComment,
  canUseAi,
}: Readonly<{ canComment: boolean; canUseAi: boolean }>) {
  const toolbar = useMemo(
    () =>
      function BoundFormattingToolbar() {
        return (
          <LeafFormattingToolbar canComment={canComment} canUseAi={canUseAi} />
        )
      },
    [canComment, canUseAi],
  )

  return <FormattingToolbarController formattingToolbar={toolbar} />
}
