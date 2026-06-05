import { detectEngines } from '../../utils/engines/index'
import { recommendEngine } from '../../utils/engines/recommend'

export default defineEventHandler(async () => {
  const detections = await detectEngines()
  const recommendations = await recommendEngine(detections)
  return { detections, recommendations }
})
