const nullByte = String.fromCharCode(0)

const replacementChar = String.fromCharCode(0xfffd)

export function looksBinary(text: string): boolean {
  const sample = text.slice(0, 4096)

  if (sample.includes(nullByte)) {
    return true
  }

  const replacements = sample.split(replacementChar).length - 1

  return replacements / Math.max(sample.length, 1) > 0.02
}
