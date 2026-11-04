import { RowPeek } from '@/components/database/row-peek'

type Props = Readonly<{ params: Promise<{ id: string }> }>

export default async function PeekOverPage({ params }: Props) {
  const { id } = await params

  return <RowPeek rowId={id} />
}
