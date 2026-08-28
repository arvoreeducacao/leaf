import type { Dictionary } from '@blocknote/core'
import { pt } from '@blocknote/core/locales'

const editorPlaceholder = 'Digite / para comandos'

export const leafDictionary: Dictionary = {
  ...pt,
  placeholders: {
    ...pt.placeholders,
    emptyDocument: editorPlaceholder,
    default: editorPlaceholder,
    heading: 'Título',
    toggleListItem: 'Item expansível',
    bulletListItem: 'Item da lista',
    numberedListItem: 'Item da lista',
    checkListItem: 'Item da lista',
  },
  slash_menu: {
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
      subtext: 'Envie uma imagem do seu computador',
      aliases: ['imagem', 'image', 'foto', 'figura'],
    },
  },
}

export const calloutSlashMenuItem = {
  title: 'Destaque',
  subtext: 'Bloco em destaque para um aviso ou dica',
  aliases: ['destaque', 'callout', 'aviso', 'dica', 'nota'],
  group: 'Blocos básicos',
}
