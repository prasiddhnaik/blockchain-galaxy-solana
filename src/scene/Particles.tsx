import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  type InstancedMesh,
  Object3D,
  Vector3,
} from 'three'
import {
  createInnerChainCurve,
  createOuterChainCurve,
  type ChainId,
} from './chainCurves'

type Particle = {
  chain: ChainId
  offset: Vector3
  progress: number
  scale: number
  speed: number
}

const particleCount = 300
const purple = new Color('#9b3fff')
const teal = new Color('#2effe9')

function randomSigned(range: number) {
  return (Math.random() - 0.5) * range
}

function createParticle(index: number): Particle {
  const chain = index % 5 < 2 ? 'inner' : 'outer'

  return {
    chain,
    offset: new Vector3(randomSigned(0.12), randomSigned(0.12), randomSigned(0.12)),
    progress: Math.random(),
    scale: 0.052 + Math.random() * 0.04,
    speed: (chain === 'inner' ? 0.055 : 0.036) + Math.random() * 0.038,
  }
}

export function Particles() {
  const meshRef = useRef<InstancedMesh>(null)
  const innerCurve = useMemo(() => createInnerChainCurve(), [])
  const outerCurve = useMemo(() => createOuterChainCurve(), [])
  const particles = useMemo(
    () => Array.from({ length: particleCount }, (_, index) => createParticle(index)),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])
  const color = useMemo(() => new Color(), [])
  const position = useMemo(() => new Vector3(), [])

  useFrame((_, delta) => {
    const mesh = meshRef.current

    if (!mesh) {
      return
    }

    particles.forEach((particle, index) => {
      particle.progress = (particle.progress + delta * particle.speed) % 1

      const curve = particle.chain === 'inner' ? innerCurve : outerCurve
      const fullProgress =
        particle.chain === 'inner'
          ? particle.progress * 0.35
          : 0.35 + particle.progress * 0.65

      curve.getPointAt(particle.progress, position)
      dummy.position.copy(position).add(particle.offset)
      dummy.scale.setScalar(particle.scale)
      dummy.updateMatrix()

      color.copy(purple).lerp(teal, fullProgress)
      mesh.setMatrixAt(index, dummy.matrix)
      mesh.setColorAt(index, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        transparent
        opacity={0.92}
        vertexColors
      />
    </instancedMesh>
  )
}
