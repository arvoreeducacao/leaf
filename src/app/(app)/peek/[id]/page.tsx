import { redirect } from 'next/navigation'

type Props = Readonly<{ params: Promise<{ id: string }> }>

export default async function PeekDirectVisit({ params }: Props) {
  const { id } = await params

  redirect(`/doc/${id}`)
}
