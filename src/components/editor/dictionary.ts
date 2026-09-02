import type { Dictionary } from '@blocknote/core'
import { en, pt } from '@blocknote/core/locales'
import type { AIDictionary } from '@blocknote/xl-ai'

import { createAiDictionary } from './ai-dictionary'

export type LeafDictionary = Dictionary & Readonly<{ ai: AIDictionary }>

export type LeafDictionaryTexts = Readonly<{
  placeholder: string
  heading: string
  toggleListItem: string
  listItem: string
}>

export type CalloutMenuItem = Readonly<{
  title: string
  subtext: string
  aliases: Array<string>
  group: string
}>

export type DatabaseMenuItem = CalloutMenuItem

const ptSlashMenu: Dictionary['slash_menu'] = {
  ...pt.slash_menu,
  heading: {
    ...pt.slash_menu.heading,
    title: 'Título 1',
    subtext: 'Título principal da seção',
  },
  heading_2: {
    ...pt.slash_menu.heading_2,
    title: 'Título 2',
    subtext: 'Título de seção',
  },
  heading_3: {
    ...pt.slash_menu.heading_3,
    title: 'Título 3',
    subtext: 'Título de subseção',
  },
  numbered_list: {
    ...pt.slash_menu.numbered_list,
    title: 'Lista numerada',
    subtext: 'Lista com itens em ordem',
  },
  bullet_list: {
    ...pt.slash_menu.bullet_list,
    title: 'Lista com marcadores',
    subtext: 'Lista sem ordem definida',
  },
  check_list: {
    ...pt.slash_menu.check_list,
    title: 'Lista de tarefas',
    subtext: 'Lista com caixas de seleção',
    aliases: ['todo', 'tarefas', 'checklist', 'caixa de selecao'],
  },
  toggle_list: {
    ...pt.slash_menu.toggle_list,
    title: 'Lista expansível',
    subtext: 'Lista com itens que abrem e fecham',
  },
  toggle_heading: {
    ...pt.slash_menu.toggle_heading,
    title: 'Título expansível 1',
    subtext: 'Título principal que abre e fecha',
  },
  toggle_heading_2: {
    ...pt.slash_menu.toggle_heading_2,
    title: 'Título expansível 2',
    subtext: 'Título de seção que abre e fecha',
  },
  toggle_heading_3: {
    ...pt.slash_menu.toggle_heading_3,
    title: 'Título expansível 3',
    subtext: 'Título de subseção que abre e fecha',
  },
  code_block: {
    ...pt.slash_menu.code_block,
    title: 'Bloco de código',
    subtext: 'Código com destaque de sintaxe',
  },
  quote: {
    ...pt.slash_menu.quote,
    title: 'Citação',
    subtext: 'Trecho citado de outra fonte',
    aliases: ['citacao', 'quote', 'blockquote', 'bq'],
  },
  paragraph: {
    ...pt.slash_menu.paragraph,
    title: 'Parágrafo',
    subtext: 'Texto comum do documento',
  },
  divider: {
    ...pt.slash_menu.divider,
    title: 'Divisor',
    subtext: 'Linha que separa dois trechos',
    aliases: ['divisor', 'separador', 'linha', 'hr'],
  },
  table: {
    ...pt.slash_menu.table,
    title: 'Tabela',
    subtext: 'Dados organizados em linhas e colunas',
  },
  image: {
    ...pt.slash_menu.image,
    title: 'Imagem',
    subtext: 'Envie uma imagem do seu dispositivo',
    aliases: ['imagem', 'image', 'foto', 'figura'],
  },
}

const enSlashMenu: Dictionary['slash_menu'] = {
  ...en.slash_menu,
  heading: {
    ...en.slash_menu.heading,
    title: 'Heading 1',
    subtext: 'Main section heading',
  },
  heading_2: {
    ...en.slash_menu.heading_2,
    title: 'Heading 2',
    subtext: 'Section heading',
  },
  heading_3: {
    ...en.slash_menu.heading_3,
    title: 'Heading 3',
    subtext: 'Subsection heading',
  },
  numbered_list: {
    ...en.slash_menu.numbered_list,
    title: 'Numbered list',
    subtext: 'List with items in order',
  },
  bullet_list: {
    ...en.slash_menu.bullet_list,
    title: 'Bulleted list',
    subtext: 'List with no set order',
  },
  check_list: {
    ...en.slash_menu.check_list,
    title: 'Task list',
    subtext: 'List with checkboxes',
  },
  toggle_list: {
    ...en.slash_menu.toggle_list,
    title: 'Toggle list',
    subtext: 'List with items that open and close',
  },
  toggle_heading: {
    ...en.slash_menu.toggle_heading,
    title: 'Toggle heading 1',
    subtext: 'Main heading that opens and closes',
  },
  toggle_heading_2: {
    ...en.slash_menu.toggle_heading_2,
    title: 'Toggle heading 2',
    subtext: 'Section heading that opens and closes',
  },
  toggle_heading_3: {
    ...en.slash_menu.toggle_heading_3,
    title: 'Toggle heading 3',
    subtext: 'Subsection heading that opens and closes',
  },
  code_block: {
    ...en.slash_menu.code_block,
    title: 'Code block',
    subtext: 'Code with syntax highlighting',
  },
  quote: {
    ...en.slash_menu.quote,
    title: 'Quote',
    subtext: 'Passage quoted from another source',
  },
  paragraph: {
    ...en.slash_menu.paragraph,
    title: 'Paragraph',
    subtext: 'Plain text of the document',
  },
  divider: {
    ...en.slash_menu.divider,
    title: 'Divider',
    subtext: 'Line that separates two passages',
  },
  table: {
    ...en.slash_menu.table,
    title: 'Table',
    subtext: 'Data organized in rows and columns',
  },
  image: {
    ...en.slash_menu.image,
    title: 'Image',
    subtext: 'Upload an image from your device',
  },
}

function baseFor(locale: string): Dictionary {
  if (locale.startsWith('pt')) {
    return { ...pt, slash_menu: ptSlashMenu }
  }

  return { ...en, slash_menu: enSlashMenu }
}

export function createLeafDictionary(
  locale: string,
  texts: LeafDictionaryTexts,
): LeafDictionary {
  const base = baseFor(locale)

  return {
    ...base,
    ai: createAiDictionary(locale),
    placeholders: {
      ...base.placeholders,
      emptyDocument: texts.placeholder,
      default: texts.placeholder,
      heading: texts.heading,
      toggleListItem: texts.toggleListItem,
      bulletListItem: texts.listItem,
      numberedListItem: texts.listItem,
      checkListItem: texts.listItem,
    },
  }
}

export function toReadOnlyDictionary(
  dictionary: LeafDictionary,
): LeafDictionary {
  return {
    ...dictionary,
    placeholders: Object.fromEntries(
      Object.keys(dictionary.placeholders).map((key) => [key, '']),
    ) as Dictionary['placeholders'],
  }
}
