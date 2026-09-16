export function fitFramePicture(imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number) {
  if (![imageWidth, imageHeight, frameWidth, frameHeight].every(value => Number.isFinite(value) && value > 0)) throw new Error('Picture dimensions must be positive.')
  const canvasWidth = Math.max(1, Math.round(1200 * frameWidth / Math.max(frameWidth, frameHeight)))
  const canvasHeight = Math.max(1, Math.round(1200 * frameHeight / Math.max(frameWidth, frameHeight)))
  const margin = Math.max(1, Math.round(Math.min(canvasWidth, canvasHeight) * .035))
  const scale = Math.min((canvasWidth - margin * 2) / imageWidth, (canvasHeight - margin * 2) / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return { canvasWidth, canvasHeight, x: (canvasWidth - width) / 2, y: (canvasHeight - height) / 2, width, height }
}