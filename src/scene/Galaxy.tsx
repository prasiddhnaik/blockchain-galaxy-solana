import { OrbitControls, Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ElementRef } from 'react'
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferGeometry,
  Group,
  Vector3,
} from 'three'
import type { ActivityCategory, ChainBlock, DataSource } from '../data/solana'
import { useSolanaBlocks } from '../data/solana'
import { Block } from './Block'
import { createPlanetTextureSet } from './textures'
import type { PlanetVariant } from './textures'

type SceneBlock = ChainBlock & {
  color: string
  id: number
  orbit: OrbitSpec
  variant: PlanetVariant
}

type OrbitSpec = {
  radiusX: number
  radiusZ: number
  angle: number
  speed: number
  tilt: number
  y: number
}

const categoryColors: Record<ActivityCategory, string> = {
  defi: '#9b3fff',
  token: '#28ffe7',
  nft: '#39ff88',
  other: '#ff6f61',
}
const categoryLabels: Record<ActivityCategory, string> = {
  defi: 'DeFi',
  token: 'Token',
  nft: 'NFT',
  other: 'Other',
}
const worldTypeLabels: Record<ActivityCategory, string> = {
  defi: 'Gas giant = DeFi',
  token: 'Ocean = Token',
  nft: 'Verdant = NFT',
  other: 'Rocky = Other',
}
const activityCategories: ActivityCategory[] = ['defi', 'token', 'nft', 'other']
const sunRadius = 0.78
const sunGlowRadius = sunRadius * 1.48
const sunClearanceMargin = sunRadius * 1.85
const orbitSurfaceMargin = sunRadius * 0.38
const orbitZAspect = 0.88
const defaultVisibleBlockCount = 30

const variantFallbacks: Record<ActivityCategory, PlanetVariant[]> = {
  defi: ['defi-generic'],
  token: ['token-generic'],
  nft: ['nft-generic'],
  other: ['other-generic'],
}

const variantSpin: Record<PlanetVariant, number> = {
  'defi-generic': 0.92,
  jupiter: 0.72,
  orca: 0.58,
  phoenix: 1.08,
  raydium: 1.18,
  system: 0.7,
  'spl-token': 1.02,
  'token-2022': 1.26,
  'token-generic': 0.94,
  'magic-eden': 0.88,
  metaplex: 0.78,
  'nft-generic': 0.96,
  tensor: 1.22,
  'other-generic': 0.74,
  'rocky-cratered': 0.62,
  'rocky-grey': 0.68,
  'rocky-red': 0.82,
}

const visualPolish = {
  bloom: {
    intensity: 1.05,
    luminanceSmoothing: 0.16,
    luminanceThreshold: 0.66,
    radius: 0.52,
  },
  float: {
    x: 0.075,
    y: 0.052,
    z: 0.045,
  },
}

function getDefaultCameraPosition(isNarrow: boolean) {
  return new Vector3(0, isNarrow ? 12.8 : 12.2, isNarrow ? 19.5 : 17.6)
}

function getSystemScale(isNarrow: boolean, maxOrbitRadius: number) {
  return Math.min(isNarrow ? 0.5 : 0.88, (isNarrow ? 8.4 : 10.8) / maxOrbitRadius)
}

function getVisibleBlockCount() {
  const configuredCount = Number(import.meta.env.VITE_BLOCK_COUNT)
  return Number.isFinite(configuredCount) && configuredCount > 0
    ? Math.floor(configuredCount)
    : defaultVisibleBlockCount
}

function getInitialFocusBlockId() {
  const rawFocusBlockId = new URLSearchParams(window.location.search).get('focusBlock')
  if (rawFocusBlockId === null) {
    return null
  }

  const focusBlockId = Number(rawFocusBlockId)
  return Number.isInteger(focusBlockId) && focusBlockId >= 0 ? focusBlockId : null
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)

    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return prefersReducedMotion
}

function resolvePlanetVariant(block: ChainBlock, index: number): PlanetVariant {
  const programName = block.dominantProgram?.toLowerCase() ?? ''

  if (block.dominantCategory === 'defi') {
    if (programName.includes('raydium')) return 'raydium'
    if (programName.includes('orca')) return 'orca'
    if (programName.includes('jupiter')) return 'jupiter'
    if (programName.includes('phoenix')) return 'phoenix'
  }

  if (block.dominantCategory === 'token') {
    if (programName.includes('token-2022')) return 'token-2022'
    if (programName.includes('system')) return 'system'
    if (programName.includes('spl') || programName.includes('token')) return 'spl-token'
  }

  if (block.dominantCategory === 'nft') {
    if (programName.includes('magic')) return 'magic-eden'
    if (programName.includes('tensor')) return 'tensor'
    if (programName.includes('metaplex')) return 'metaplex'
  }

  if (block.dominantCategory === 'other') {
    if (programName.includes('system')) return 'rocky-grey'
    if (programName.includes('memo')) return 'rocky-red'
    if (programName) return 'rocky-cratered'
  }

  const fallbacks = variantFallbacks[block.dominantCategory]
  return fallbacks[index % fallbacks.length]
}

function createOrbitSpecs(blocks: ChainBlock[]): OrbitSpec[] {
  const startingAngles = [1.12, 2.62, 0.42, 3.14, 0.88, 2.08, 0.08, 1.62]
  const maxPlanetRadius = Math.max(...blocks.map((block) => block.size), 0.3)
  let currentRadius =
    (sunGlowRadius + maxPlanetRadius + sunClearanceMargin) / orbitZAspect

  return blocks.map((block, index) => {
    if (index > 0) {
      const previousRadius = blocks[index - 1].size
      const currentPlanetRadius = block.size
      currentRadius +=
        (previousRadius + currentPlanetRadius + orbitSurfaceMargin) / orbitZAspect
    }

    const progress = blocks.length <= 1 ? 0 : index / (blocks.length - 1)

    return {
      angle: startingAngles[index % startingAngles.length],
      radiusX: currentRadius * (1.05 + Math.sin(index * 1.2) * 0.014),
      radiusZ: currentRadius * orbitZAspect,
      speed: 0.095 - progress * 0.055,
      tilt: -0.12 + Math.sin(index * 0.82) * 0.08,
      y: (index % 3 - 1) * 0.08,
    }
  })
}

function getOrbitPosition(orbit: OrbitSpec, angle: number) {
  const orbitSin = Math.sin(angle)
  return new Vector3(
    Math.cos(angle) * orbit.radiusX,
    orbit.y + orbitSin * Math.sin(orbit.tilt) * orbit.radiusZ,
    orbitSin * orbit.radiusZ,
  )
}

function BlockchainScene({
  blocks,
  deselectSignal,
  initialFocusBlockId,
  onHoverBlock,
  prefersReducedMotion,
  selectedBlockId,
  setSelectedBlockId,
}: {
  blocks: SceneBlock[]
  deselectSignal: number
  initialFocusBlockId: number | null
  onHoverBlock: (isHovering: boolean) => void
  prefersReducedMotion: boolean
  selectedBlockId: number | null
  setSelectedBlockId: (id: number | null) => void
}) {
  const galaxyRef = useRef<Group>(null)
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)
  const resumeRotationRef = useRef<number | undefined>(undefined)
  const [resumeDelayActive, setResumeDelayActive] = useState(false)
  const { camera, size } = useThree()
  const isNarrow = size.width < 640
  const baseGroupPosition = useMemo(
    () => new Vector3(0, isNarrow ? -0.72 : -0.2, 0),
    [isNarrow],
  )
  const maxOrbitRadius = useMemo(
    () =>
      Math.max(
        ...blocks.map((block) => Math.max(block.orbit.radiusX, block.orbit.radiusZ)),
        1,
      ),
    [blocks],
  )
  const systemScale = getSystemScale(isNarrow, maxOrbitRadius)
  const planetTextures = useMemo(
    () => ({
      'defi-generic': createPlanetTextureSet('defi', 'defi-generic'),
      jupiter: createPlanetTextureSet('defi', 'jupiter'),
      orca: createPlanetTextureSet('defi', 'orca'),
      phoenix: createPlanetTextureSet('defi', 'phoenix'),
      raydium: createPlanetTextureSet('defi', 'raydium'),
      system: createPlanetTextureSet('token', 'system'),
      'spl-token': createPlanetTextureSet('token', 'spl-token'),
      'token-2022': createPlanetTextureSet('token', 'token-2022'),
      'token-generic': createPlanetTextureSet('token', 'token-generic'),
      'magic-eden': createPlanetTextureSet('nft', 'magic-eden'),
      metaplex: createPlanetTextureSet('nft', 'metaplex'),
      'nft-generic': createPlanetTextureSet('nft', 'nft-generic'),
      tensor: createPlanetTextureSet('nft', 'tensor'),
      'other-generic': createPlanetTextureSet('other', 'other-generic'),
      'rocky-cratered': createPlanetTextureSet('other', 'rocky-cratered'),
      'rocky-grey': createPlanetTextureSet('other', 'rocky-grey'),
      'rocky-red': createPlanetTextureSet('other', 'rocky-red'),
    }),
    [],
  )

  const flyCamera = useCallback(
    (position: Vector3, target: Vector3, duration = 1.32) => {
      const controls = controlsRef.current

      gsap.killTweensOf(camera.position)
      if (controls) {
        gsap.killTweensOf(controls.target)
      }

      gsap.to(camera.position, {
        duration,
        ease: 'power3.inOut',
        x: position.x,
        y: position.y,
        z: position.z,
        onUpdate: () => controls?.update(),
      })
      if (controls) {
        gsap.to(controls.target, {
          duration,
          ease: 'power3.inOut',
          x: target.x,
          y: target.y,
          z: target.z,
          onUpdate: () => controls.update(),
        })
      }
    },
    [camera],
  )

  const handleSelectBlock = useCallback(
    (id: number, worldPosition: Vector3) => {
      if (resumeRotationRef.current) {
        window.clearTimeout(resumeRotationRef.current)
      }
      setResumeDelayActive(false)

      const block = blocks[id]

      if (!block) {
        return
      }

      const target = worldPosition.clone()
      const cameraDirection = camera.position.clone().sub(worldPosition).normalize()
      const focusPosition = worldPosition
        .clone()
        .add(cameraDirection.multiplyScalar(isNarrow ? 5.2 : 4.6))
        .add(new Vector3(0, isNarrow ? 0.42 : 0.28, 0))

      setSelectedBlockId(id)
      flyCamera(focusPosition, target)
    },
    [blocks, camera.position, flyCamera, isNarrow, setSelectedBlockId],
  )

  const handleDeselect = useCallback(() => {
    setSelectedBlockId(null)
    flyCamera(getDefaultCameraPosition(isNarrow), new Vector3(0, 0, 0), 1.24)

    if (resumeRotationRef.current) {
      window.clearTimeout(resumeRotationRef.current)
    }
    setResumeDelayActive(true)
    resumeRotationRef.current = window.setTimeout(() => {
      resumeRotationRef.current = undefined
      setResumeDelayActive(false)
    }, 2600)
  }, [flyCamera, isNarrow, setSelectedBlockId])

  useEffect(() => {
    if (selectedBlockId === null && !resumeDelayActive) {
      camera.position.copy(getDefaultCameraPosition(isNarrow))
      controlsRef.current?.target.set(0, 0, 0)
      controlsRef.current?.update()
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
    }
  }, [camera, isNarrow, resumeDelayActive, selectedBlockId])

  useEffect(() => {
    if (deselectSignal > 0) {
      const timeoutId = window.setTimeout(handleDeselect, 0)

      return () => window.clearTimeout(timeoutId)
    }
  }, [deselectSignal, handleDeselect])

  useEffect(() => {
    return () => {
      if (resumeRotationRef.current) {
        window.clearTimeout(resumeRotationRef.current)
      }
    }
  }, [])

  useFrame(({ clock }) => {
    if (!galaxyRef.current) {
      return
    }

    if (selectedBlockId === null && !resumeDelayActive) {
      galaxyRef.current.rotation.x = prefersReducedMotion
        ? 0
        : Math.sin(clock.elapsedTime * 0.16) * 0.035

      if (!prefersReducedMotion) {
        galaxyRef.current.position.set(
          baseGroupPosition.x + Math.sin(clock.elapsedTime * 0.21) * visualPolish.float.x,
          baseGroupPosition.y +
            Math.sin(clock.elapsedTime * 0.27 + 1.2) * visualPolish.float.y,
          baseGroupPosition.z +
            Math.sin(clock.elapsedTime * 0.18 + 2.1) * visualPolish.float.z,
        )
      }
    } else {
      galaxyRef.current.position.lerp(baseGroupPosition, 0.08)
    }
  })

  return (
    <>
      <color attach="background" args={['#070d22']} />
      <fog attach="fog" args={['#070d22', 18, 38]} />
      <ambientLight color="#8fa7cf" intensity={0.18} />
      <hemisphereLight
        args={['#8ea8d8', '#050611', 0.34]}
        position={[0, 8, -12]}
      />
      <pointLight
        color="#6f85b8"
        decay={1.7}
        distance={30}
        intensity={18}
        position={[0, 8, -18]}
      />
      <Stars
        radius={110}
        depth={60}
        count={1900}
        factor={4.2}
        saturation={0.35}
        fade
        speed={0.45}
      />
      <group
        ref={galaxyRef}
        position={baseGroupPosition}
        scale={systemScale}
      >
        <Sun />
        {blocks.map((block) => (
          <OrbitLine key={`orbit-${block.id}`} orbit={block.orbit} />
        ))}
        {blocks.map((block, index) => {
          const textures = planetTextures[block.variant]

          return (
            <OrbitingPlanet
              block={block}
              cityLightsMap={textures.cityLightsMap}
              initialFocusBlockId={initialFocusBlockId}
              isMotionPaused={selectedBlockId !== null || prefersReducedMotion}
              id={index}
              isSelected={selectedBlockId === index}
              key={index}
              onHoverChange={onHoverBlock}
              onSelect={handleSelectBlock}
              surfaceMap={textures.surfaceMap}
            />
          )
        })}
      </group>
      <OrbitControls
        autoRotate={false}
        dampingFactor={0.06}
        enableDamping
        enablePan={false}
        maxDistance={34}
        minDistance={6.4}
        ref={controlsRef}
      />
    </>
  )
}

function OrbitingPlanet({
  block,
  cityLightsMap,
  id,
  initialFocusBlockId,
  isMotionPaused,
  isSelected,
  onHoverChange,
  onSelect,
  surfaceMap,
}: {
  block: SceneBlock
  cityLightsMap: ReturnType<typeof createPlanetTextureSet>['cityLightsMap']
  id: number
  initialFocusBlockId: number | null
  isMotionPaused: boolean
  isSelected: boolean
  onHoverChange: (isHovering: boolean) => void
  onSelect: (id: number, position: Vector3) => void
  surfaceMap: ReturnType<typeof createPlanetTextureSet>['surfaceMap']
}) {
  const groupRef = useRef<Group>(null)
  const hasAutoFocusedRef = useRef(false)
  const localOrigin = useMemo(() => new Vector3(0, 0, 0), [])
  const angleRef = useRef(block.orbit.angle)

  useEffect(() => {
    if (
      hasAutoFocusedRef.current ||
      initialFocusBlockId !== id ||
      !groupRef.current
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const worldPosition = getOrbitPosition(block.orbit, angleRef.current)
      groupRef.current?.parent?.localToWorld(worldPosition)
      hasAutoFocusedRef.current = true
      onSelect(id, worldPosition)
    }, 260)

    return () => window.clearTimeout(timeoutId)
  }, [block.orbit, id, initialFocusBlockId, onSelect])

  useFrame(({ clock }, delta) => {
    const group = groupRef.current

    if (!group) {
      return
    }

    if (!isMotionPaused) {
      angleRef.current += delta * block.orbit.speed
    }

    const angle = angleRef.current
    group.position.copy(getOrbitPosition(block.orbit, angle))

    if (!isMotionPaused) {
      group.rotation.y += (0.0055 + block.recency * 0.0035) * variantSpin[block.variant]
      group.rotation.z = Math.sin(clock.elapsedTime * 0.2 + id) * 0.035
    }
  })

  return (
    <group ref={groupRef}>
      <Block
        categoryColor={block.color}
        cityLightsMap={cityLightsMap}
        failedTxRatio={block.failedTxRatio}
        hasRing={block.dominantCategory === 'defi' && block.size >= 0.44}
        hot={block.recency === 1}
        id={id}
        isSelected={isSelected}
        onHoverChange={onHoverChange}
        onSelect={onSelect}
        position={localOrigin}
        recency={block.recency}
        size={block.size}
        surfaceMap={surfaceMap}
      />
    </group>
  )
}

function OrbitLine({ orbit }: { orbit: OrbitSpec }) {
  const geometry = useMemo(() => {
    const points = Array.from({ length: 128 }, (_, index) => {
      const angle = (index / 128) * Math.PI * 2
      return new Vector3(
        Math.cos(angle) * orbit.radiusX,
        orbit.y + Math.sin(angle) * Math.sin(orbit.tilt) * orbit.radiusZ,
        Math.sin(angle) * orbit.radiusZ,
      )
    })

    return new BufferGeometry().setFromPoints(points)
  }, [orbit])

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color="#7891bb" opacity={0.18} transparent />
    </lineLoop>
  )
}

function Sun() {
  return (
    <group>
      <pointLight color="#fff4c6" decay={1.25} distance={24} intensity={285} />
      <mesh>
        <sphereGeometry args={[0.78, 48, 48]} />
        <meshBasicMaterial color="#fff2b6" toneMapped={false} />
      </mesh>
      <mesh scale={1.48}>
        <sphereGeometry args={[0.78, 40, 40]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color="#ffb347"
          depthWrite={false}
          opacity={0.13}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  )
}

export function Galaxy() {
  const visibleBlockCount = getVisibleBlockCount()
  const initialFocusBlockId = useMemo(() => getInitialFocusBlockId(), [])
  const chainData = useSolanaBlocks(visibleBlockCount)
  const prefersReducedMotion = usePrefersReducedMotion()
  const orbitSpecs = useMemo(
    () => createOrbitSpecs(chainData.blocks),
    [chainData.blocks],
  )
  const blocks = useMemo<SceneBlock[]>(
    () =>
      chainData.blocks.map((block, index) => {
        const color = categoryColors[block.dominantCategory]

        return {
          ...block,
          color,
          id: index,
          orbit: orbitSpecs[index],
          variant: resolvePlanetVariant(block, index),
        }
      }),
    [chainData.blocks, orbitSpecs],
  )
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(
    initialFocusBlockId,
  )
  const [deselectSignal, setDeselectSignal] = useState(0)
  const [isHoveringBlock, setIsHoveringBlock] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const selectedBlock =
    selectedBlockId === null ? null : (blocks[selectedBlockId] ?? null)

  return (
    <main className="galaxy-shell">
      <div className="galaxy-title" aria-hidden="true">
        <h1>Blockchain Galaxy</h1>
        <p>Recent Solana blocks orbiting a live-data sun.</p>
      </div>
      {showLegend && <CategoryLegend onDismiss={() => setShowLegend(false)} />}
      <InfoPanel selectedBlock={selectedBlock} source={chainData.source} />
      <Canvas
        camera={{ position: [0, 12.2, 17.6], fov: 48, rotation: [-0.606, 0, 0] }}
        className={`galaxy-canvas ${isHoveringBlock ? 'is-hovering-block' : ''}`}
        dpr={0.85}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        onPointerMissed={() => setDeselectSignal((signal) => signal + 1)}
      >
        <BlockchainScene
          blocks={blocks}
          deselectSignal={deselectSignal}
          initialFocusBlockId={initialFocusBlockId}
          onHoverBlock={setIsHoveringBlock}
          prefersReducedMotion={prefersReducedMotion}
          selectedBlockId={selectedBlockId}
          setSelectedBlockId={setSelectedBlockId}
        />
      </Canvas>
    </main>
  )
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function CategoryLegend({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside className="category-legend" aria-label="Block color legend">
      <div className="category-legend__topline">
        <span>Activity</span>
        <button aria-label="Hide category legend" onClick={onDismiss} type="button">
          ×
        </button>
      </div>
      <ul>
        {activityCategories.map((category) => (
          <li key={category}>
            <span
              className="category-legend__swatch"
              style={{ '--category-color': categoryColors[category] } as CSSProperties}
            />
            {worldTypeLabels[category]}
          </li>
        ))}
      </ul>
    </aside>
  )
}

function InfoPanel({
  selectedBlock,
  source,
}: {
  selectedBlock: SceneBlock | null
  source: DataSource
}) {
  return (
    <aside
      className={`block-info-panel ${selectedBlock ? 'is-visible' : ''}`}
      style={
        { '--block-glow': selectedBlock?.color ?? '#28ffe7' } as CSSProperties
      }
    >
      <div className="block-info-panel__topline">
        <div className="block-info-panel__label">Selected Block</div>
        <div className={`block-info-panel__source is-${source}`}>
          <span />
          {source === 'live' ? 'LIVE' : 'CACHED'}
        </div>
      </div>
      <dl>
        <div>
          <dt>Slot</dt>
          <dd>{selectedBlock?.slot ?? '---'}</dd>
        </div>
        <div>
          <dt>Transactions</dt>
          <dd>{selectedBlock?.transactions ?? '---'}</dd>
        </div>
        <div>
          <dt>Timestamp</dt>
          <dd>{selectedBlock?.timestamp ?? '--:--:--'}</dd>
        </div>
      </dl>
      {selectedBlock && (
        <div className="block-info-panel__activity">
          <div className="block-info-panel__activity-title">Activity Mix</div>
          <div className="activity-mix-bar" aria-label="Activity mix">
            {activityCategories.map((category) => (
              <span
                key={category}
                style={
                  {
                    '--category-color': categoryColors[category],
                    width: `${selectedBlock.categoryMix[category] * 100}%`,
                  } as CSSProperties
                }
                title={`${categoryLabels[category]} ${formatPercent(
                  selectedBlock.categoryMix[category],
                )}`}
              />
            ))}
          </div>
          <div className="activity-mix-labels">
            {activityCategories.map((category) => (
              <span key={category}>
                {categoryLabels[category]}{' '}
                {formatPercent(selectedBlock.categoryMix[category])}
              </span>
            ))}
          </div>
          <div className="activity-mix-footnote">
            Vote {selectedBlock.programCounts.vote} · Infra{' '}
            {selectedBlock.programCounts.infra} · Failed{' '}
            {formatPercent(selectedBlock.failedTxRatio)}
          </div>
        </div>
      )}
    </aside>
  )
}
