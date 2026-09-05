import { notionists } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { NextResponse } from 'next/server'

import { isAvatarSeed } from '@/lib/avatar'

const avatarSize = 256

const backgroundColors = [
  'b6e3f4',
  'c0aede',
  'd1d4f9',
  'ffd5dc',
  'ffdfbf',
  'c9e4c5',
  'f7d9c4',
  'e2d1f9',
]

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ seed: string }> },
) {
  const { seed } = await params

  if (!isAvatarSeed(seed)) {
    return new NextResponse(null, { status: 404 })
  }

  const svg = createAvatar(notionists, {
    seed,
    size: avatarSize,
    backgroundColor: backgroundColors,
    radius: 50,
    scale: 90,
  }).toString()

  return new NextResponse(svg, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
