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
} from '@blocknote/react'

function LeafFormattingToolbar() {
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
    </FormattingToolbar>
  )
}

export function LeafFormattingToolbarController() {
  return <FormattingToolbarController formattingToolbar={LeafFormattingToolbar} />
}
