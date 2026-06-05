import { detectEngines } from '../utils/engines/index'

export default defineEventHandler(async () => {
  return await detectEngines()
})
