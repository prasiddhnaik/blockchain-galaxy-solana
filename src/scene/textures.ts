import {
  CanvasTexture,
  LinearFilter,
  MirroredRepeatWrapping,
  RepeatWrapping,
} from 'three'

function makeCanvas(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas 2D context is unavailable.')
  }

  return { canvas, context }
}

function finishTexture(canvas: HTMLCanvasElement, repeat = 1) {
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

export function createChainLinkTextures() {
  const { canvas, context } = makeCanvas(256)

  context.fillStyle = '#565b72'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.lineCap = 'round'
  context.lineJoin = 'round'

  for (let y = -64; y < 320; y += 64) {
    for (let x = -64; x < 320; x += 96) {
      context.save()
      context.translate(x + 48, y + 32)
      context.rotate(-Math.PI / 4)
      context.strokeStyle = '#bac5ff'
      context.lineWidth = 16
      context.strokeRect(-38, -18, 76, 36)
      context.strokeStyle = '#272c44'
      context.lineWidth = 8
      context.strokeRect(-30, -10, 60, 20)
      context.restore()
    }
  }

  const normalMap = finishTexture(canvas, 7)
  normalMap.wrapS = MirroredRepeatWrapping
  normalMap.wrapT = MirroredRepeatWrapping

  const emissiveSource = makeCanvas(256)
  emissiveSource.context.drawImage(canvas, 0, 0)
  emissiveSource.context.globalCompositeOperation = 'source-in'
  emissiveSource.context.fillStyle = '#a873ff'
  emissiveSource.context.fillRect(0, 0, 256, 256)
  const emissiveMap = finishTexture(emissiveSource.canvas, 7)

  return { normalMap, emissiveMap }
}

export function createCircuitTexture() {
  const { canvas, context } = makeCanvas(256)

  context.fillStyle = '#02020b'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#ffffff'
  context.lineWidth = 4
  context.lineCap = 'round'
  context.globalAlpha = 0.72

  for (let y = 24; y < 256; y += 42) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(60, y)
    context.lineTo(60, y + 18)
    context.lineTo(132, y + 18)
    context.lineTo(132, y - 12)
    context.lineTo(256, y - 12)
    context.stroke()
  }

  context.globalAlpha = 0.95
  context.fillStyle = '#ffffff'
  for (let y = 30; y < 256; y += 42) {
    for (let x = 28; x < 256; x += 72) {
      context.beginPath()
      context.arc(x, y, 5, 0, Math.PI * 2)
      context.fill()
    }
  }

  return finishTexture(canvas, 3)
}
