type BlockLike = Readonly<{
  id: string
  children?: ReadonlyArray<BlockLike>
}>

export function collectBlockIds(
  blocks: ReadonlyArray<BlockLike>,
): Array<string> {
  const ids: Array<string> = []

  function walk(list: ReadonlyArray<BlockLike>) {
    for (const block of list) {
      ids.push(block.id)

      if (block.children && block.children.length > 0) {
        walk(block.children)
      }
    }
  }

  walk(blocks)

  return ids
}
