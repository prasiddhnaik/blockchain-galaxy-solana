import { CatmullRomCurve3, Vector3 } from 'three'

export type ChainId = 'inner' | 'outer'

export type BlockPlacement = {
  chain: ChainId
  progress: number
}

const innerSpiralPoints = [
  new Vector3(-3.1, -0.55, -0.25),
  new Vector3(-2.45, 0.55, 0.9),
  new Vector3(-1.35, 0.86, 0.18),
  new Vector3(-0.68, 0.05, -0.72),
  new Vector3(-1.42, -0.76, -0.15),
  new Vector3(-2.18, -0.18, 0.52),
  new Vector3(-1.28, 0.42, 0.78),
  new Vector3(-0.25, 0.26, 0.08),
]

const outerLoopPoints = [
  new Vector3(-0.25, 0.26, 0.08),
  new Vector3(1.1, 1.45, -0.92),
  new Vector3(3.42, 1.05, 0.78),
  new Vector3(4.95, -0.46, 0.22),
  new Vector3(3.62, -1.82, -0.95),
  new Vector3(1.2, -1.42, -0.35),
  new Vector3(0.35, -0.12, 0.98),
  new Vector3(2.55, 0.62, 1.35),
  new Vector3(5.55, 0.2, -0.18),
]

export const blockPlacements: BlockPlacement[] = [
  { chain: 'inner', progress: 0.06 },
  { chain: 'inner', progress: 0.34 },
  { chain: 'inner', progress: 0.58 },
  { chain: 'inner', progress: 0.82 },
  { chain: 'outer', progress: 0.22 },
  { chain: 'outer', progress: 0.48 },
  { chain: 'outer', progress: 0.74 },
  { chain: 'outer', progress: 1 },
]

export function createInnerChainCurve() {
  return new CatmullRomCurve3(innerSpiralPoints, false, 'catmullrom', 0.48)
}

export function createOuterChainCurve() {
  return new CatmullRomCurve3(outerLoopPoints, false, 'catmullrom', 0.42)
}
