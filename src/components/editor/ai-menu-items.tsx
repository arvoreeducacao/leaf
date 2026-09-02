import type { BlockNoteEditor } from '@blocknote/core'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { AIMenuSuggestionItem } from '@blocknote/xl-ai'
import {
  AIExtension,
  aiDocumentFormats,
  getAISlashMenuItems,
  getDefaultAIMenuItems,
} from '@blocknote/xl-ai'
import type { ReactElement } from 'react'

import {
  AlignJustifyIcon,
  ArrowExpandIcon,
  ArrowShrinkIcon,
  BackIcon,
  CancelIcon,
  CheckIcon,
  FeatherPenIcon,
  FontdefaultIcon,
  GlobeIcon,
  InfoIcon,
  LightningIcon,
  ListCheckIcon,
  MagicWandIcon,
  MicIcon,
  RotateIcon,
} from '@/components/icons'

import type { LeafAiMenuTexts } from './ai-dictionary'

type AiResponseStatus = Parameters<typeof getDefaultAIMenuItems>[1]

type LeafEditorLike = BlockNoteEditor<any, any, any>

const iconByKey: Record<string, ReactElement> = {
  continue_writing: <FeatherPenIcon aria-hidden="true" className="size-4" />,
  summarize: <AlignJustifyIcon aria-hidden="true" className="size-4" />,
  action_items: <ListCheckIcon aria-hidden="true" className="size-4" />,
  write_anything: <MagicWandIcon aria-hidden="true" className="size-4" />,
  improve_writing: <LightningIcon aria-hidden="true" className="size-4" />,
  fix_spelling: <CheckIcon aria-hidden="true" className="size-4" />,
  simplify: <FontdefaultIcon aria-hidden="true" className="size-4" />,
  translate: <GlobeIcon aria-hidden="true" className="size-4" />,
  make_shorter: <ArrowShrinkIcon aria-hidden="true" className="size-4" />,
  make_longer: <ArrowExpandIcon aria-hidden="true" className="size-4" />,
  change_tone: <MicIcon aria-hidden="true" className="size-4" />,
  explain: <InfoIcon aria-hidden="true" className="size-4" />,
  accept: <CheckIcon aria-hidden="true" className="size-4" />,
  revert: <BackIcon aria-hidden="true" className="size-4" />,
  retry: <RotateIcon aria-hidden="true" className="size-4" />,
  cancel: <CancelIcon aria-hidden="true" className="size-4" />,
}

const selectionOrder = [
  'improve_writing',
  'fix_spelling',
  'make_shorter',
  'make_longer',
  'simplify',
  'change_tone',
  'translate',
  'explain',
]

function updateOnlyTools() {
  return aiDocumentFormats.html.getStreamToolsProvider({
    defaultStreamTools: { add: false, delete: false, update: true },
  })
}

function addOnlyTools() {
  return aiDocumentFormats.html.getStreamToolsProvider({
    defaultStreamTools: { add: true, delete: false, update: false },
  })
}

function selectionExtras(
  editor: LeafEditorLike,
  texts: LeafAiMenuTexts,
): Array<AIMenuSuggestionItem> {
  const ai = editor.getExtension(AIExtension)

  if (!ai) {
    return []
  }

  return [
    {
      key: 'make_shorter',
      title: texts.makeShorter,
      size: 'small',
      onItemClick: async () => {
        await ai.invokeAI({
          useSelection: true,
          userPrompt:
            'Rewrite the selection so it says the same thing in fewer words.',
          streamToolsProvider: updateOnlyTools(),
        })
      },
    },
    {
      key: 'make_longer',
      title: texts.makeLonger,
      size: 'small',
      onItemClick: async () => {
        await ai.invokeAI({
          useSelection: true,
          userPrompt:
            'Develop the selection with more detail, keeping every claim already made.',
          streamToolsProvider: updateOnlyTools(),
        })
      },
    },
    {
      key: 'change_tone',
      title: texts.changeTone,
      size: 'small',
      onItemClick: (setPrompt) => {
        setPrompt(texts.changeTonePlaceholder)
      },
    },
    {
      key: 'explain',
      title: texts.explain,
      size: 'small',
      onItemClick: async () => {
        await ai.invokeAI({
          useSelection: true,
          userPrompt:
            'Explain the selection in plain language, as new blocks right after it. Do not change the selected text.',
          streamToolsProvider: addOnlyTools(),
        })
      },
    },
  ]
}

function withLeafIcons(items: Array<AIMenuSuggestionItem>) {
  return items.map((item) => ({
    ...item,
    icon: iconByKey[item.key] ?? item.icon,
  }))
}

function sortedBySelectionOrder(items: Array<AIMenuSuggestionItem>) {
  const rankOf = (key: string) => {
    const index = selectionOrder.indexOf(key)

    return index === -1 ? selectionOrder.length : index
  }

  return [...items].sort((left, right) => rankOf(left.key) - rankOf(right.key))
}

export function createLeafAiMenuItems(texts: LeafAiMenuTexts) {
  return (editor: LeafEditorLike, status: AiResponseStatus) => {
    const defaults = withLeafIcons(getDefaultAIMenuItems(editor, status))

    if (status !== 'user-input' || !editor.getSelection()) {
      return defaults
    }

    return sortedBySelectionOrder([
      ...defaults,
      ...withLeafIcons(selectionExtras(editor, texts)),
    ])
  }
}

export function leafAiSlashMenuItems(
  editor: LeafEditorLike,
): Array<DefaultReactSuggestionItem> {
  return getAISlashMenuItems(editor).map((item) => ({
    ...item,
    icon: <MagicWandIcon aria-hidden="true" className="size-4" />,
  }))
}
