'use client'

import { useEffect, useRef } from 'react'

import type { FaceState } from '@/lib/ai-face-state'
import { isMiniFace } from '@/lib/ai-face-state'
import { cn } from '@/shared/utils'

import './ai-face.css'

const bodyPath =
  'M50 32 C44 21 30 20 24 30 C16 43 19 63 31 75 C39 83 44 79 50 79 C56 79 61 83 69 75 C81 63 84 43 76 30 C70 20 56 21 50 32 Z'
const stemPath = 'M50 32 C51 24 53 18 57 13'
const leafPath = 'M57 15 C64 8 76 10 78 18 C72 25 61 24 57 15 Z'
const mouthPath = 'M41 62 Q50 69 59 62'
const arcPaths = ['M34 53 Q39 46 44 53', 'M56 53 Q61 46 66 53'] as const
const eyeCenters = [39, 61] as const

const gazeReach = 5.5
const gazeSoftness = 1.7

type Props = Readonly<{
  state: FaceState
  size: number
  follow?: boolean
  className?: string
}>

export function AiFace({ state, size, follow = false, className }: Props) {
  const root = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const node = root.current

    if (!follow || !node) {
      return
    }

    let frame = 0

    function track(event: PointerEvent) {
      if (frame !== 0) {
        return
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0

        const box = node?.getBoundingClientRect()

        if (!box || box.width === 0) {
          return
        }

        const x = (event.clientX - (box.left + box.width / 2)) / (box.width * gazeSoftness)
        const y = (event.clientY - (box.top + box.height / 2)) / (box.height * gazeSoftness)

        node?.style.setProperty(
          '--leaf-face-x',
          (Math.max(-1, Math.min(1, x)) * gazeReach).toFixed(2),
        )
        node?.style.setProperty(
          '--leaf-face-y',
          (Math.max(-1, Math.min(1, y)) * gazeReach * 0.8).toFixed(2),
        )
      })
    }

    window.addEventListener('pointermove', track)

    return () => {
      window.removeEventListener('pointermove', track)

      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [follow])

  return (
    <svg
      aria-hidden="true"
      className={cn(
        'leaf-face',
        `leaf-face-${state}`,
        isMiniFace(size) && 'leaf-face-mini',
        className,
      )}
      height={size}
      ref={root}
      viewBox="0 0 100 100"
      width={size}
    >
      <g className="leaf-face-head">
        <circle className="leaf-face-ring" cx="50" cy="54" r="44" />
        <g className="leaf-face-breath">
          <path className="leaf-face-line" d={bodyPath} />
          <path className="leaf-face-line" d={stemPath} />
          <path className="leaf-face-line leaf-face-leaf" d={leafPath} />
          <g className="leaf-face-gaze">
            <g className="leaf-face-follow">
              {eyeCenters.map((cx) => (
                <ellipse
                  className="leaf-face-eye"
                  cx={cx}
                  cy="52"
                  key={cx}
                  rx="4.8"
                  ry="5.6"
                />
              ))}
              {arcPaths.map((arc) => (
                <path
                  className="leaf-face-line leaf-face-arc"
                  d={arc}
                  key={arc}
                />
              ))}
              <path className="leaf-face-line leaf-face-mouth" d={mouthPath} />
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
