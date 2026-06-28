import { Stars, Text } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useMemo, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  DoubleSide,
  LinearFilter,
  RepeatWrapping,
  type Group,
  Vector3,
} from 'three'
import { createPlanetTextureSet, type PlanetKind, type PlanetVariant } from './textures'

type ThumbnailPlanet = {
  color: string
  kind: PlanetKind
  label: string
  position: [number, number, number]
  ring?: boolean
  scale: number
  variant: PlanetVariant
}

const thumbnailPlanets: ThumbnailPlanet[] = [
  {
    color: '#b065ff',
    kind: 'defi',
    label: 'Jupiter',
    position: [3.35, 0.1, 0.1],
    ring: true,
    scale: 0.98,
    variant: 'jupiter',
  },
  {
    color: '#28ffe7',
    kind: 'token',
    label: 'SPL Token',
    position: [0.95, -1.55, 0.5],
    scale: 0.58,
    variant: 'spl-token',
  },
  {
    color: '#42ff91',
    kind: 'nft',
    label: 'NFTs',
    position: [5.5, -1.3, -0.35],
    scale: 0.5,
    variant: 'magic-eden',
  },
  {
    color: '#ff7c5f',
    kind: 'other',
    label: 'Blocks',
    position: [6.8, 1.0, -1.2],
    scale: 0.42,
    variant: 'rocky-red',
  },
  {
    color: '#7af8ff',
    kind: 'token',
    label: 'Mainnet',
    position: [2.0, 1.7, -1.6],
    scale: 0.38,
    variant: 'token-cloud',
  },
]

function createThumbnailSunTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas 2D context is unavailable.')
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#fff8bd')
  gradient.addColorStop(0.32, '#ffd05a')
  gradient.addColorStop(0.62, '#ff8634')
  gradient.addColorStop(1, '#dd3e29')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.globalCompositeOperation = 'screen'
  for (let i = 0; i < 220; i += 1) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    const radius = 8 + Math.random() * 28
    const hot = context.createRadialGradient(x, y, 0, x, y, radius)

    hot.addColorStop(0, 'rgba(255, 255, 222, 0.48)')
    hot.addColorStop(0.52, 'rgba(255, 155, 53, 0.2)')
    hot.addColorStop(1, 'rgba(255, 84, 34, 0)')
    context.fillStyle = hot
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }

  context.globalCompositeOperation = 'multiply'
  context.fillStyle = 'rgba(120, 16, 18, 0.16)'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1.5, 1)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true

  return texture
}

function ThumbnailSun() {
  const surfaceRef = useRef<Group>(null)
  const coronaRef = useRef<Group>(null)
  const texture = useMemo(() => createThumbnailSunTexture(), [])

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime

    if (surfaceRef.current) {
      surfaceRef.current.rotation.y = elapsed * 0.12
      surfaceRef.current.rotation.z = Math.sin(elapsed * 0.28) * 0.04
    }

    if (coronaRef.current) {
      coronaRef.current.scale.setScalar(1 + Math.sin(elapsed * 1.2) * 0.025)
      coronaRef.current.rotation.z = -elapsed * 0.04
    }
  })

  return (
    <group position={[-2.7, 0.05, -0.2]}>
      <pointLight color="#fff0ba" decay={1.18} distance={28} intensity={520} />
      <group ref={surfaceRef}>
        <mesh>
          <sphereGeometry args={[1.25, 88, 88]} />
          <meshBasicMaterial color="#fff2b2" map={texture} toneMapped={false} />
        </mesh>
        <mesh scale={1.03}>
          <sphereGeometry args={[1.25, 72, 72]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color="#ff762f"
            depthWrite={false}
            opacity={0.18}
            toneMapped={false}
            transparent
          />
        </mesh>
      </group>
      <group ref={coronaRef}>
        <mesh scale={1.42}>
          <sphereGeometry args={[1.25, 56, 56]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color="#ff9c3e"
            depthWrite={false}
            opacity={0.13}
            toneMapped={false}
            transparent
          />
        </mesh>
        <mesh scale={1.88}>
          <sphereGeometry args={[1.25, 56, 56]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color="#ffd46a"
            depthWrite={false}
            opacity={0.062}
            toneMapped={false}
            transparent
          />
        </mesh>
      </group>
    </group>
  )
}

function OrbitRibbon({
  color,
  radiusX,
  radiusZ,
  y,
}: {
  color: string
  radiusX: number
  radiusZ: number
  y: number
}) {
  const points = useMemo(
    () =>
      Array.from({ length: 192 }, (_, index) => {
        const angle = (index / 192) * Math.PI * 2

        return new Vector3(
          Math.cos(angle) * radiusX,
          y + Math.sin(angle) * 0.12,
          Math.sin(angle) * radiusZ,
        )
      }),
    [radiusX, radiusZ, y],
  )

  return (
    <lineLoop>
      <bufferGeometry attach="geometry" setFromPoints={points} />
      <lineBasicMaterial color={color} opacity={0.24} transparent />
    </lineLoop>
  )
}

function ThumbnailPlanetMesh({ planet, index }: { planet: ThumbnailPlanet; index: number }) {
  const groupRef = useRef<Group>(null)
  const textures = useMemo(
    () => createPlanetTextureSet(planet.kind, planet.variant),
    [planet.kind, planet.variant],
  )
  const planetColor = useMemo(
    () => new Color(planet.color).lerp(new Color('#ffffff'), 0.08),
    [planet.color],
  )

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime

    if (!groupRef.current) {
      return
    }

    groupRef.current.rotation.y = elapsed * (0.2 + index * 0.035)
    groupRef.current.rotation.z = Math.sin(elapsed * 0.28 + index) * 0.03
  })

  return (
    <group position={planet.position}>
      <group ref={groupRef} rotation={[0.16 + index * 0.08, 0, -0.08]}>
        <mesh>
          <sphereGeometry args={[planet.scale, 64, 64]} />
          <meshStandardMaterial
            color={planetColor}
            emissive={planet.color}
            emissiveIntensity={0.012}
            emissiveMap={textures.cityLightsMap}
            map={textures.surfaceMap}
            metalness={0.02}
            roughness={0.46}
          />
        </mesh>
        <mesh scale={1.012}>
          <sphereGeometry args={[planet.scale, 48, 48]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={planet.color}
            depthWrite={false}
            opacity={0.032}
            side={BackSide}
            transparent
          />
        </mesh>
        {planet.ring && (
          <group rotation={[Math.PI * 0.58, 0.16, Math.PI * 0.09]}>
            <mesh>
              <ringGeometry args={[planet.scale * 1.46, planet.scale * 2.18, 128]} />
              <meshBasicMaterial
                color="#dcb6ff"
                depthWrite={false}
                opacity={0.2}
                side={DoubleSide}
                transparent
              />
            </mesh>
            <mesh>
              <ringGeometry args={[planet.scale * 2.34, planet.scale * 2.48, 128]} />
              <meshBasicMaterial
                blending={AdditiveBlending}
                color={planet.color}
                depthWrite={false}
                opacity={0.14}
                side={DoubleSide}
                transparent
              />
            </mesh>
          </group>
        )}
      </group>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#e9f5ff"
        fontSize={0.13}
        outlineBlur={0.025}
        outlineColor="#000000"
        outlineOpacity={0.4}
        position={[0, -planet.scale * 1.55, 0]}
      >
        {planet.label}
      </Text>
    </group>
  )
}

function ThumbnailSceneContents() {
  const groupRef = useRef<Group>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return
    }

    groupRef.current.rotation.x = -0.14 + Math.sin(clock.elapsedTime * 0.16) * 0.015
    groupRef.current.rotation.y = -0.12 + Math.sin(clock.elapsedTime * 0.12) * 0.025
  })

  return (
    <>
      <color attach="background" args={['#050817']} />
      <fog attach="fog" args={['#050817', 16, 34]} />
      <ambientLight color="#aac7ff" intensity={0.28} />
      <hemisphereLight args={['#9abaff', '#050716', 0.34]} position={[0, 8, -12]} />
      <directionalLight color="#fff8d8" intensity={1.65} position={[-3, 4, 5]} />
      <Stars
        count={2400}
        depth={72}
        factor={4.8}
        fade
        radius={120}
        saturation={0.42}
        speed={0.28}
      />
      <group ref={groupRef} position={[0.35, -0.3, 0]} rotation={[-0.14, -0.12, 0]}>
        <ThumbnailSun />
        <OrbitRibbon color="#7ef5ff" radiusX={4.5} radiusZ={2.2} y={0.02} />
        <OrbitRibbon color="#b37bff" radiusX={6.1} radiusZ={3.05} y={-0.1} />
        <OrbitRibbon color="#39ff88" radiusX={7.6} radiusZ={3.82} y={-0.2} />
        <OrbitRibbon color="#ff8c67" radiusX={8.9} radiusZ={4.45} y={-0.28} />
        {thumbnailPlanets.map((planet, index) => (
          <ThumbnailPlanetMesh index={index} key={planet.label} planet={planet} />
        ))}
      </group>
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.42}
          luminanceSmoothing={0.2}
          luminanceThreshold={0.42}
          radius={0.64}
        />
        <DepthOfField bokehScale={1.35} focalLength={0.026} focusDistance={0.02} />
        <Vignette darkness={0.58} eskil={false} offset={0.22} />
      </EffectComposer>
    </>
  )
}

export function ThumbnailScene() {
  return (
    <main className="thumbnail-shell">
      <Canvas
        camera={{ fov: 42, position: [2.2, 4.45, 10.6], rotation: [-0.34, 0.05, 0.02] }}
        className="thumbnail-canvas"
        dpr={1}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
        onCreated={({ camera }) => camera.lookAt(1.9, -0.3, 0)}
      >
        <ThumbnailSceneContents />
      </Canvas>
      <div className="thumbnail-copy" aria-hidden="true">
        <p className="thumbnail-eyebrow">Solana Hackathon Demo</p>
        <h1>Blockchain Galaxy</h1>
        <p>Explore mainnet activity as a living solar system.</p>
      </div>
      <div className="thumbnail-badge" aria-hidden="true">
        <span>LIVE + CACHED DATA</span>
        <strong>Programs become planets</strong>
      </div>
    </main>
  )
}
