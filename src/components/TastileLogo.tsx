export function TastileLogo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} className={className} aria-hidden="true">
      <g transform="translate(512 512) scale(1.43) translate(-512 -512)">
        <g transform="translate(512.75 512.5) rotate(-45) scale(0.86) translate(-272 -272)">
          <path
            d="M48 0L304 0A48 48 0 0 1 352 48L352 304A48 48 0 0 1 304 352L48 352A48 48 0 0 1 0 304L0 48A48 48 0 0 1 48 0Z"
            fill="currentColor"
          />
          <path
            d="M432 192L496 192A48 48 0 0 1 544 240L544 496A48 48 0 0 1 496 544L240 544A48 48 0 0 1 192 496L192 432A48 48 0 0 1 240 384L304 384A80 80 0 0 0 384 304L384 240A48 48 0 0 1 432 192Z"
            fill="#2563EB"
          />
        </g>
      </g>
    </svg>
  )
}
