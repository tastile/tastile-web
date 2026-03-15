import {
  buildTwoByTwoBlockPath,
  buildLowerLBlockPath,
  defaultTastileTwoByTwoBlock,
  defaultTastileLowerLBlock,
  defaultTastileIconGeometry,
} from '@/lib/tastileIconGenerator'

export function TastileLogo({ size = 24, className }: { size?: number; className?: string }) {
  const { transform } = defaultTastileIconGeometry
  const upperPath = buildTwoByTwoBlockPath(defaultTastileTwoByTwoBlock)
  const lowerPath = buildLowerLBlockPath(defaultTastileLowerLBlock)
  const transformStr = `translate(${transform.translateX} ${transform.translateY}) rotate(${transform.rotationDeg}) scale(${transform.scale}) translate(-${transform.originX} -${transform.originY})`

  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} className={className} aria-hidden="true">
      <g transform={transformStr}>
        <path d={upperPath} fill="currentColor" />
        <path d={lowerPath} fill="currentColor" />
      </g>
    </svg>
  )
}
