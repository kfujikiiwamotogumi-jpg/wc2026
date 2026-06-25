import type { ScreenSnapApi } from './index'

declare global {
  interface Window {
    api: ScreenSnapApi
  }
}

export {}
