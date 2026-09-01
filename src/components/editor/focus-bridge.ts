export const documentTitleInputId = 'leaf-document-title'

const focusEditorEvent = 'leaf:focus-editor-start'

export function requestEditorFocus() {
  window.dispatchEvent(new Event(focusEditorEvent))
}

export function onEditorFocusRequest(handler: () => void) {
  window.addEventListener(focusEditorEvent, handler)

  return () => {
    window.removeEventListener(focusEditorEvent, handler)
  }
}

export function focusDocumentTitle() {
  const field = window.document.getElementById(documentTitleInputId)

  if (!(field instanceof HTMLTextAreaElement)) {
    return false
  }

  field.focus()
  const end = field.value.length
  field.setSelectionRange(end, end)

  return true
}
