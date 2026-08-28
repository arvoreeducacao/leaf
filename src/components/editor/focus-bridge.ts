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
  const input = window.document.getElementById(documentTitleInputId)

  if (!(input instanceof HTMLInputElement)) {
    return false
  }

  input.focus()
  const end = input.value.length
  input.setSelectionRange(end, end)

  return true
}
