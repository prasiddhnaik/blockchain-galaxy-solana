import { useMemo } from 'react'
import {
  AdditiveBlending,
  Color,
  Float32BufferAttribute,
  type CatmullRomCurve3,
  TubeGeometry,
} from 'three'
import {
  createInnerChainCurve,
  createOuterChainCurve,
} from './chainCurves'
import { createChainLinkTextures } from './textures'

function createColoredTube(
  curve: CatmullRomCurve3,
  tubularSegments: number,
  radius: number,
  radialSegments: number,
  startColor: Color,
  endColor: Color,
) {
  const geometry = new TubeGeometry(
    curve,
    tubularSegments,
    radius,
    radialSegments,
    false,
  )
  const colors: number[] = []
  const color = new Color()
  const ringSize = radialSegments + 1

  for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) {
    const progress = Math.min(1, Math.floor(vertex / ringSize) / tubularSegments)
    color.copy(startColor).lerp(endColor, progress)
    colors.push(color.r, color.g, color.b)
  }

  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

export function ChainPath() {
  const innerCurve = useMemo(() => createInnerChainCurve(), [])
  const outerCurve = useMemo(() => createOuterChainCurve(), [])
  const purple = useMemo(() => new Color('#8f35ff'), [])
  const teal = useMemo(() => new Color('#28ffe7'), [])
  const dimPurple = useMemo(() => new Color('#5125a8'), [])
  const textures = useMemo(() => createChainLinkTextures(), [])

  const innerGeometry = useMemo(
    () => createColoredTube(innerCurve, 150, 0.075, 18, dimPurple, purple),
    [dimPurple, innerCurve, purple],
  )
  const outerGeometry = useMemo(
    () => createColoredTube(outerCurve, 220, 0.095, 22, purple, teal),
    [outerCurve, purple, teal],
  )

  return (
    <group>
      <mesh geometry={innerGeometry}>
        <meshStandardMaterial
          color="#ffffff"
          emissive="#6f32db"
          emissiveIntensity={0.9}
          emissiveMap={textures.emissiveMap}
          metalness={0.2}
          normalMap={textures.normalMap}
          normalScale={[0.18, 0.18]}
          roughness={0.42}
          transparent
          opacity={0.78}
          vertexColors
        />
      </mesh>
      <mesh geometry={outerGeometry}>
        <meshStandardMaterial
          color="#ffffff"
          emissive="#42ffee"
          emissiveIntensity={1.35}
          emissiveMap={textures.emissiveMap}
          metalness={0.18}
          normalMap={textures.normalMap}
          normalScale={[0.22, 0.22]}
          roughness={0.34}
          transparent
          opacity={0.9}
          vertexColors
        />
      </mesh>
      <mesh geometry={outerGeometry}>
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={teal}
          depthWrite={false}
          transparent
          opacity={0.18}
          vertexColors
        />
      </mesh>
    </group>
  )
}
