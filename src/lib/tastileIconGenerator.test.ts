import { describe, expect, it } from 'vitest'

import {
  buildLowerLBlockPath,
  buildTwoByTwoBlockPath,
  defaultTastileIconGeometry,
  defaultTastileLowerLBlock,
  defaultTastileTwoByTwoBlock,
  renderTastileIconSvg,
} from './tastileIconGenerator'

describe('tastileIconGenerator', () => {
  it('builds the current two-by-two block path from numeric parameters', () => {
    expect(buildTwoByTwoBlockPath(defaultTastileTwoByTwoBlock)).toBe(defaultTastileIconGeometry.upperPath)
  })

  it('builds the current lower L block path from numeric parameters', () => {
    expect(buildLowerLBlockPath(defaultTastileLowerLBlock)).toBe(defaultTastileIconGeometry.lowerPath)
  })

  it('exposes the current default icon geometry', () => {
    expect(defaultTastileIconGeometry.transform).toEqual({
      translateX: 512.75,
      translateY: 512.5,
      rotationDeg: 45,
      scale: 0.86,
      originX: 272,
      originY: 272,
    })

    expect(defaultTastileIconGeometry.upperPath).toBe(
      'M48 0L304 0A48 48 0 0 1 352 48L352 304A48 48 0 0 1 304 352L48 352A48 48 0 0 1 0 304L0 48A48 48 0 0 1 48 0Z'
    )

    expect(defaultTastileIconGeometry.lowerPath).toBe(
      'M432 192L496 192A48 48 0 0 1 544 240L544 496A48 48 0 0 1 496 544L240 544A48 48 0 0 1 192 496L192 432A48 48 0 0 1 240 384L304 384A80 80 0 0 0 384 304L384 240A48 48 0 0 1 432 192Z'
    )

    expect(defaultTastileTwoByTwoBlock).toEqual({
      cellSize: 160,
      gap: 32,
      outerRadius: 48,
      innerRadius: 48,
    })

    expect(defaultTastileLowerLBlock).toEqual({
      cellSize: 160,
      gap: 32,
      outerRadius: 48,
      innerRadius: 24,
    })
  })

  it('renders the current production icon svg', () => {
    expect(renderTastileIconSvg()).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">
  <title id="title">Tastile icon</title>
  <desc id="desc">A white rounded square containing a centered black symbol made from a two-by-two block and an L-shaped block rotated 45 degrees.</desc>
  <rect x="88" y="88" width="848" height="848" rx="168" fill="#FFFFFF"/>
  <g transform="translate(512.75 512.5) rotate(45) scale(0.86) translate(-272 -272)">
    <path d="M48 0L304 0A48 48 0 0 1 352 48L352 304A48 48 0 0 1 304 352L48 352A48 48 0 0 1 0 304L0 48A48 48 0 0 1 48 0Z" fill="#000000"/>
    <path d="M432 192L496 192A48 48 0 0 1 544 240L544 496A48 48 0 0 1 496 544L240 544A48 48 0 0 1 192 496L192 432A48 48 0 0 1 240 384L304 384A80 80 0 0 0 384 304L384 240A48 48 0 0 1 432 192Z" fill="#000000"/>
  </g>
</svg>`)
  })

  it('renders the current preview icon svg', () => {
    expect(renderTastileIconSvg({ preview: true })).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">
  <title id="title">Tastile icon preview</title>
  <desc id="desc">Preview board for the Tastile icon, showing the white rounded square on a light gray background.</desc>
  <rect width="1024" height="1024" fill="#F2F4F7"/>
  <rect x="88" y="88" width="848" height="848" rx="168" fill="#FFFFFF"/>
  <g transform="translate(512.75 512.5) rotate(45) scale(0.86) translate(-272 -272)">
    <path d="M48 0L304 0A48 48 0 0 1 352 48L352 304A48 48 0 0 1 304 352L48 352A48 48 0 0 1 0 304L0 48A48 48 0 0 1 48 0Z" fill="#000000"/>
    <path d="M432 192L496 192A48 48 0 0 1 544 240L544 496A48 48 0 0 1 496 544L240 544A48 48 0 0 1 192 496L192 432A48 48 0 0 1 240 384L304 384A80 80 0 0 0 384 304L384 240A48 48 0 0 1 432 192Z" fill="#000000"/>
  </g>
</svg>`)
  })
})
