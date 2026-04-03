import type { LuxAPI } from '../preload/index'

declare global {
  interface Window {
    lux: LuxAPI
  }
}
