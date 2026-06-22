import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
  Vector3,
} from 'three'

type BlockProps = {
  categoryColor: string
  circuitMap: Texture
  failedTxRatio: number
  id: number
  isSelected: boolean
  onHoverChange: (isHovering: boolean) => void
  onSelect: (id: number, position: Vector3) => void
  position: Vector3
  recency: number
  size: number
  hot?: boolean
}

export function Block({
  categoryColor,
  circuitMap,
  failedTxRatio,
  id,
  isSelected,
  onHoverChange,
  onSelect,
  position,
  recency,
  size,
  hot = false,
}: BlockProps) {
  const groupRef = useRef<Group>(null)
  const coreRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshStandardMaterial>(null)
  const baseEmissiveIntensity = hot ? 5.9 : 1.35 + recency * 2.25
  const targetEmissiveIntensityRef = useRef(baseEmissiveIntensity)
  const coreColor = useMemo(() => {
    const color = new Color(categoryColor).lerp(new Color('#ffffff'), 0.12)
    return hot ? color.lerp(new Color('#f3fffb'), 0.42) : color
  }, [categoryColor, hot])
  const glowColor = useMemo(() => new Color(categoryColor), [categoryColor])

  useEffect(() => {
    const group = groupRef.current
    const material = materialRef.current

    if (!group || !material) {
      return
    }

    gsap.to(group.scale, {
      duration: 0.24,
      ease: 'power2.out',
      x: isSelected ? 1.15 : 1,
      y: isSelected ? 1.15 : 1,
      z: isSelected ? 1.15 : 1,
    })
    targetEmissiveIntensityRef.current = isSelected
      ? baseEmissiveIntensity * 1.45
      : baseEmissiveIntensity
    gsap.to(material, {
      duration: 0.24,
      ease: 'power2.out',
      emissiveIntensity: targetEmissiveIntensityRef.current,
    })
  }, [baseEmissiveIntensity, isSelected])

  useFrame(({ clock }) => {
    const material = materialRef.current

    if (!material || failedTxRatio < 0.12) {
      return
    }

    const flickerStrength = Math.min(0.1, failedTxRatio * 0.7)
    const flicker =
      1 +
      Math.sin(clock.elapsedTime * 17 + id * 1.9) *
        flickerStrength *
        (0.35 + recency * 0.65)

    material.emissiveIntensity = targetEmissiveIntensityRef.current * flicker
  })

  function handlePointerOver(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    onHoverChange(true)

    if (!groupRef.current || !materialRef.current) {
      return
    }

    targetEmissiveIntensityRef.current = baseEmissiveIntensity * 1.55
    gsap.to(groupRef.current.scale, {
      duration: 0.22,
      ease: 'power2.out',
      x: 1.15,
      y: 1.15,
      z: 1.15,
    })
    gsap.to(materialRef.current, {
      duration: 0.18,
      ease: 'power2.out',
      emissiveIntensity: targetEmissiveIntensityRef.current,
    })
  }

  function handlePointerOut(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    onHoverChange(false)

    if (!groupRef.current || !materialRef.current || isSelected) {
      return
    }

    targetEmissiveIntensityRef.current = baseEmissiveIntensity
    gsap.to(groupRef.current.scale, {
      duration: 0.28,
      ease: 'power2.out',
      x: 1,
      y: 1,
      z: 1,
    })
    gsap.to(materialRef.current, {
      duration: 0.24,
      ease: 'power2.out',
      emissiveIntensity: targetEmissiveIntensityRef.current,
    })
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    const worldPosition = new Vector3()

    coreRef.current?.getWorldPosition(worldPosition)
    onSelect(id, worldPosition)
  }

  return (
    <group
      onClick={handleClick}
      onPointerOut={handlePointerOut}
      onPointerOver={handlePointerOver}
      position={position}
      ref={groupRef}
    >
      <mesh ref={coreRef}>
        <sphereGeometry args={[size, 48, 48]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={glowColor}
          emissiveIntensity={baseEmissiveIntensity}
          emissiveMap={circuitMap}
          roughness={0.25}
          metalness={0.08}
          ref={materialRef}
        />
      </mesh>
      <mesh scale={hot ? 1.72 : 1.45}>
        <sphereGeometry args={[size, 48, 48]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={glowColor}
          depthWrite={false}
          transparent
          opacity={hot ? 0.24 : 0.13}
        />
      </mesh>
    </group>
  )
}
