import { OrbitControls, Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Bloom,
  BrightnessContrast,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ElementRef } from 'react'
import { ACESFilmicToneMapping, Group, Vector3 } from 'three'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import type { ActivityCategory, ChainBlock, DataSource } from '../data/solana'
import { useSolanaBlocks } from '../data/solana'
import { Block } from './Block'
import { ChainPath } from './ChainPath'
import {
  blockPlacements,
  createInnerChainCurve,
  createOuterChainCurve,
} from './chainCurves'
import { Particles } from './Particles'
import { createCircuitTexture } from './textures'

type SceneBlock = ChainBlock & {
  chain: 'inner' | 'outer'
  color: string
  id: number
  progress: number
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
const activityCategories: ActivityCategory[] = ['defi', 'token', 'nft', 'other']

const visualPolish = {
  bloom: {
    intensity: 1.42,
    luminanceSmoothing: 0.16,
    luminanceThreshold: 0.26,
    radius: 0.68,
  },
  colorGrade: {
    contrast: 0.035,
    saturation: 0.075,
    vignetteDarkness: 0.32,
    vignetteOffset: 0.2,
  },
  depthOfField: {
    bokehScale: 1.35,
    focalLength: 0.034,
    focusRange: 0.02,
    resolutionScale: 0.74,
  },
  float: {
    x: 0.075,
    y: 0.052,
    z: 0.045,
  },
}

function getDefaultCameraPosition(isNarrow: boolean) {
  return new Vector3(0, isNarrow ? 2.85 : 2.35, isNarrow ? 13.4 : 9.2)
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

function BlockchainScene({
  blocks,
  deselectSignal,
  onHoverBlock,
  prefersReducedMotion,
  selectedBlockId,
  setSelectedBlockId,
}: {
  blocks: SceneBlock[]
  deselectSignal: number
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
    () => new Vector3(0, isNarrow ? -0.95 : -0.15, 0),
    [isNarrow],
  )
  const [dofTarget, setDofTarget] = useState(() => new Vector3(0.85, 0.05, -0.15))
  const innerCurve = useMemo(() => createInnerChainCurve(), [])
  const outerCurve = useMemo(() => createOuterChainCurve(), [])
  const circuitMap = useMemo(() => createCircuitTexture(), [])
  const blockPositions = useMemo(
    () =>
      blockPlacements.map((block) =>
        block.chain === 'inner'
          ? innerCurve.getPointAt(block.progress)
          : outerCurve.getPointAt(block.progress),
      ),
    [innerCurve, outerCurve],
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
        .add(cameraDirection.multiplyScalar(isNarrow ? 4.2 : 3.25))
        .add(new Vector3(0, isNarrow ? 0.42 : 0.28, 0))

      setSelectedBlockId(id)
      setDofTarget(target)
      flyCamera(focusPosition, target)
    },
    [blocks, camera.position, flyCamera, isNarrow, setSelectedBlockId],
  )

  const handleDeselect = useCallback(() => {
    setSelectedBlockId(null)
    setDofTarget(new Vector3(0.85, 0.05, -0.15))
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

  useFrame(({ clock }, delta) => {
    if (!galaxyRef.current) {
      return
    }

    if (selectedBlockId === null && !resumeDelayActive) {
      galaxyRef.current.rotation.y += delta * 0.075
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
      <fog attach="fog" args={['#070d22', 8, 19]} />
      <ambientLight intensity={0.16} />
      <pointLight color="#8b4dff" intensity={22} position={[-4, 3, 5]} />
      <pointLight color="#25f7e8" intensity={12} position={[4, -2, 3]} />
      <Stars
        radius={80}
        depth={44}
        count={2800}
        factor={4.2}
        saturation={0.35}
        fade
        speed={0.45}
      />
      <group
        ref={galaxyRef}
        position={baseGroupPosition}
        scale={isNarrow ? 0.72 : 1}
      >
        <ChainPath />
        <Particles />
        {blocks.map((block, index) => (
          <Block
            categoryColor={block.color}
            circuitMap={circuitMap}
            failedTxRatio={block.failedTxRatio}
            hot={block.recency === 1}
            id={index}
            isSelected={selectedBlockId === index}
            key={index}
            onHoverChange={onHoverBlock}
            onSelect={handleSelectBlock}
            position={blockPositions[index]}
            recency={block.recency}
            size={block.size}
          />
        ))}
      </group>
      <EffectComposer>
        <DepthOfField
          bokehScale={visualPolish.depthOfField.bokehScale}
          focalLength={visualPolish.depthOfField.focalLength}
          focusRange={visualPolish.depthOfField.focusRange}
          resolutionScale={visualPolish.depthOfField.resolutionScale}
          target={dofTarget}
        />
        <Bloom
          intensity={visualPolish.bloom.intensity}
          luminanceSmoothing={visualPolish.bloom.luminanceSmoothing}
          luminanceThreshold={visualPolish.bloom.luminanceThreshold}
          mipmapBlur
          radius={visualPolish.bloom.radius}
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <BrightnessContrast
          blendFunction={BlendFunction.NORMAL}
          brightness={0}
          contrast={visualPolish.colorGrade.contrast}
        />
        <HueSaturation
          blendFunction={BlendFunction.NORMAL}
          hue={0}
          saturation={visualPolish.colorGrade.saturation}
        />
        <Vignette
          darkness={visualPolish.colorGrade.vignetteDarkness}
          offset={visualPolish.colorGrade.vignetteOffset}
        />
      </EffectComposer>
      <OrbitControls
        autoRotate={selectedBlockId === null && !resumeDelayActive}
        autoRotateSpeed={0.36}
        dampingFactor={0.06}
        enableDamping
        enablePan={false}
        maxDistance={13}
        minDistance={5.5}
        ref={controlsRef}
      />
    </>
  )
}

export function Galaxy() {
  const chainData = useSolanaBlocks(blockPlacements.length)
  const prefersReducedMotion = usePrefersReducedMotion()
  const blocks = useMemo<SceneBlock[]>(
    () =>
      chainData.blocks.map((block, index) => {
        const placement = blockPlacements[index]
        const color = categoryColors[block.dominantCategory]

        return {
          ...block,
          chain: placement.chain,
          color,
          id: index,
          progress: placement.progress,
        }
      }),
    [chainData.blocks],
  )
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [deselectSignal, setDeselectSignal] = useState(0)
  const [isHoveringBlock, setIsHoveringBlock] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const selectedBlock =
    selectedBlockId === null ? null : (blocks[selectedBlockId] ?? null)

  return (
    <main className="galaxy-shell">
      <div className="galaxy-title" aria-hidden="true">
        <h1>Blockchain Galaxy</h1>
        <p>A glowing Solana chain drifting through a bloom-lit starfield.</p>
      </div>
      {showLegend && <CategoryLegend onDismiss={() => setShowLegend(false)} />}
      <InfoPanel selectedBlock={selectedBlock} source={chainData.source} />
      <Canvas
        camera={{ position: [0, 2.35, 9.2], fov: 48 }}
        className={`galaxy-canvas ${isHoveringBlock ? 'is-hovering-block' : ''}`}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
        onPointerMissed={() => setDeselectSignal((signal) => signal + 1)}
      >
        <BlockchainScene
          blocks={blocks}
          deselectSignal={deselectSignal}
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
            {categoryLabels[category]}
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
