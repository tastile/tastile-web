export type TastileFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fill: string;
};

export type TastileTransform = {
  translateX: number;
  translateY: number;
  rotationDeg: number;
  scale: number;
  originX: number;
  originY: number;
};

export type TwoByTwoBlock = {
  cellSize: number;
  gap: number;
  outerRadius: number;
  innerRadius: number;
};

export type LowerLBlock = {
  cellSize: number;
  gap: number;
  outerRadius: number;
  innerRadius: number;
};

export type TastileIconGeometry = {
  viewBox: string;
  foreground: string;
  previewBackground: string;
  frame: TastileFrame;
  transform: TastileTransform;
  upperPath: string;
  lowerPath: string;
};

export const defaultTastileTwoByTwoBlock: TwoByTwoBlock = {
  cellSize: 160,
  gap: 32,
  outerRadius: 48,
  innerRadius: 48,
};

export const defaultTastileLowerLBlock: LowerLBlock = {
  cellSize: 160,
  gap: 32,
  outerRadius: 48,
  innerRadius: 24,
};

type Point = {
  x: number;
  y: number;
};

function unitDirection(from: Point, to: Point): Point {
  return {
    x: Math.sign(to.x - from.x),
    y: Math.sign(to.y - from.y),
  };
}

function buildRoundedOrthogonalPath(points: Point[], radii: number[]): string {
  const count = points.length;
  const segments = points.map((point, index) => {
    const prev = points[(index + count - 1) % count];
    const next = points[(index + 1) % count];
    const radius = radii[index];
    const incoming = unitDirection(prev, point);
    const outgoing = unitDirection(point, next);
    const start = {
      x: point.x - incoming.x * radius,
      y: point.y - incoming.y * radius,
    };
    const end = {
      x: point.x + outgoing.x * radius,
      y: point.y + outgoing.y * radius,
    };
    const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
    return {
      radius,
      start,
      end,
      sweepFlag: cross > 0 ? 1 : 0,
    };
  });

  const path = [`M${segments[0].end.x} ${segments[0].end.y}`];

  for (let index = 1; index < count; index += 1) {
    const segment = segments[index];
    path.push(`L${segment.start.x} ${segment.start.y}`);
    path.push(
      `A${segment.radius} ${segment.radius} 0 0 ${segment.sweepFlag} ${segment.end.x} ${segment.end.y}`,
    );
  }

  path.push(`L${segments[0].start.x} ${segments[0].start.y}`);
  path.push(
    `A${segments[0].radius} ${segments[0].radius} 0 0 ${segments[0].sweepFlag} ${segments[0].end.x} ${segments[0].end.y}`,
  );
  path.push("Z");

  return path.join("");
}

export function buildTwoByTwoBlockPath(block: TwoByTwoBlock): string {
  const size = block.cellSize * 2 + block.gap;
  const points: Point[] = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];

  const radii = [block.outerRadius, block.outerRadius, block.outerRadius, block.outerRadius];

  return buildRoundedOrthogonalPath(points, radii);
}

export function buildLowerLBlockPath(block: LowerLBlock): string {
  const pitch = block.cellSize + block.gap;
  const far = pitch * 2 + block.cellSize;
  const connectionOuterRadius = block.outerRadius + block.gap;
  const points: Point[] = [
    { x: pitch * 2, y: pitch },
    { x: far, y: pitch },
    { x: far, y: far },
    { x: pitch, y: far },
    { x: pitch, y: pitch * 2 },
    { x: pitch * 2, y: pitch * 2 },
  ];

  const radii = [
    block.outerRadius,
    block.outerRadius,
    block.outerRadius,
    block.outerRadius,
    block.outerRadius,
    connectionOuterRadius,
  ];

  return buildRoundedOrthogonalPath(points, radii);
}

export const defaultTastileIconGeometry: TastileIconGeometry = {
  viewBox: "0 0 1024 1024",
  foreground: "#000000",
  previewBackground: "#F2F4F7",
  frame: {
    x: 88,
    y: 88,
    width: 848,
    height: 848,
    radius: 168,
    fill: "#FFFFFF",
  },
  transform: {
    translateX: 512.75,
    translateY: 512.5,
    rotationDeg: 45,
    scale: 0.86,
    originX: 272,
    originY: 272,
  },
  upperPath: buildTwoByTwoBlockPath(defaultTastileTwoByTwoBlock),
  lowerPath: buildLowerLBlockPath(defaultTastileLowerLBlock),
};

type RenderOptions = {
  preview?: boolean;
  geometry?: Partial<TastileIconGeometry>;
};

function renderFrame(frame: TastileFrame): string {
  return `  <rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="${frame.radius}" fill="${frame.fill}"/>`;
}

function renderTransform(transform: TastileTransform): string {
  return `translate(${transform.translateX} ${transform.translateY}) rotate(${transform.rotationDeg}) scale(${transform.scale}) translate(-${transform.originX} -${transform.originY})`;
}

function resolveGeometry(overrides?: Partial<TastileIconGeometry>): TastileIconGeometry {
  if (!overrides) {
    return defaultTastileIconGeometry;
  }

  return {
    ...defaultTastileIconGeometry,
    ...overrides,
    frame: {
      ...defaultTastileIconGeometry.frame,
      ...overrides.frame,
    },
    transform: {
      ...defaultTastileIconGeometry.transform,
      ...overrides.transform,
    },
  };
}

export function renderTastileIconSvg(options: RenderOptions = {}): string {
  const geometry = resolveGeometry(options.geometry);
  const title = options.preview ? "Tastile icon preview" : "Tastile icon";
  const description = options.preview
    ? "Preview board for the Tastile icon, showing the white rounded square on a light gray background."
    : "A white rounded square containing a centered black symbol made from a two-by-two block and an L-shaped block rotated 45 degrees.";

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${geometry.viewBox}" role="img" aria-labelledby="title desc">`,
    `  <title id="title">${title}</title>`,
    `  <desc id="desc">${description}</desc>`,
  ];

  if (options.preview) {
    lines.push(`  <rect width="1024" height="1024" fill="${geometry.previewBackground}"/>`);
  }

  lines.push(renderFrame(geometry.frame));
  lines.push(`  <g transform="${renderTransform(geometry.transform)}">`);
  lines.push(`    <path d="${geometry.upperPath}" fill="${geometry.foreground}"/>`);
  lines.push(`    <path d="${geometry.lowerPath}" fill="${geometry.foreground}"/>`);
  lines.push("  </g>");
  lines.push("</svg>");

  return lines.join("\n");
}
