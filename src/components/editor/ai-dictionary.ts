import type { AIDictionary } from '@blocknote/xl-ai'
import { en, pt } from '@blocknote/xl-ai/locales'

const ptAi: AIDictionary = {
  ...pt,
  formatting_toolbar: {
    ai: { tooltip: 'Pedir para a IA' },
  },
  slash_menu: {
    ai: {
      ...pt.slash_menu.ai,
      title: 'Pedir para a IA',
      subtext: 'Escrever, resumir ou continuar o texto',
      aliases: ['ia', 'ai', 'inteligencia artificial', 'escrever', 'gerar'],
      group: 'IA',
    },
  },
  ai_default_commands: {
    continue_writing: {
      ...pt.ai_default_commands.continue_writing,
      title: 'Continuar escrevendo',
    },
    summarize: {
      ...pt.ai_default_commands.summarize,
      title: 'Resumir',
    },
    add_action_items: {
      ...pt.ai_default_commands.add_action_items,
      title: 'Listar próximos passos',
    },
    write_anything: {
      ...pt.ai_default_commands.write_anything,
      title: 'Escrever sobre…',
      prompt_placeholder: 'Escrever sobre ',
    },
    simplify: {
      ...pt.ai_default_commands.simplify,
      title: 'Simplificar',
    },
    translate: {
      ...pt.ai_default_commands.translate,
      title: 'Traduzir…',
      prompt_placeholder: 'Traduzir para ',
    },
    fix_spelling: {
      ...pt.ai_default_commands.fix_spelling,
      title: 'Corrigir ortografia',
    },
    improve_writing: {
      ...pt.ai_default_commands.improve_writing,
      title: 'Melhorar a escrita',
    },
  },
  ai_menu: {
    input_placeholder: 'Peça uma edição ou escreva um pedido…',
    status: {
      thinking: 'Pensando…',
      editing: 'Escrevendo…',
      error: 'Não deu para responder',
    },
    actions: {
      accept: { ...pt.ai_menu.actions.accept, title: 'Aceitar' },
      retry: { ...pt.ai_menu.actions.retry, title: 'Tentar de novo' },
      cancel: { ...pt.ai_menu.actions.cancel, title: 'Cancelar' },
      revert: { ...pt.ai_menu.actions.revert, title: 'Desfazer' },
    },
  },
}

const enAi: AIDictionary = {
  ...en,
  formatting_toolbar: {
    ai: { tooltip: 'Ask AI' },
  },
  slash_menu: {
    ai: {
      ...en.slash_menu.ai,
      title: 'Ask AI',
      subtext: 'Write, summarize or continue the text',
      group: 'AI',
    },
  },
  ai_default_commands: {
    ...en.ai_default_commands,
    add_action_items: {
      ...en.ai_default_commands.add_action_items,
      title: 'List next steps',
    },
    write_anything: {
      ...en.ai_default_commands.write_anything,
      title: 'Write about…',
    },
    improve_writing: {
      ...en.ai_default_commands.improve_writing,
      title: 'Improve the writing',
    },
  },
  ai_menu: {
    ...en.ai_menu,
    input_placeholder: 'Ask for an edit or write a request…',
    status: {
      thinking: 'Thinking…',
      editing: 'Writing…',
      error: 'Could not answer',
    },
    actions: {
      accept: { ...en.ai_menu.actions.accept, title: 'Accept' },
      retry: { ...en.ai_menu.actions.retry, title: 'Try again' },
      cancel: { ...en.ai_menu.actions.cancel, title: 'Cancel' },
      revert: { ...en.ai_menu.actions.revert, title: 'Undo' },
    },
  },
}

export function createAiDictionary(locale: string): AIDictionary {
  return locale.startsWith('pt') ? ptAi : enAi
}

export function aiAgentName(locale: string) {
  return locale.startsWith('pt') ? 'IA' : 'AI'
}

export type LeafAiMenuTexts = Readonly<{
  makeShorter: string
  makeLonger: string
  changeTone: string
  changeTonePlaceholder: string
  explain: string
}>

const ptMenuTexts: LeafAiMenuTexts = {
  makeShorter: 'Encurtar',
  makeLonger: 'Desenvolver',
  changeTone: 'Mudar o tom…',
  changeTonePlaceholder: 'Mudar o tom para ',
  explain: 'Explicar',
}

const enMenuTexts: LeafAiMenuTexts = {
  makeShorter: 'Make shorter',
  makeLonger: 'Make longer',
  changeTone: 'Change tone…',
  changeTonePlaceholder: 'Change the tone to ',
  explain: 'Explain',
}

export function createAiMenuTexts(locale: string): LeafAiMenuTexts {
  return locale.startsWith('pt') ? ptMenuTexts : enMenuTexts
}
