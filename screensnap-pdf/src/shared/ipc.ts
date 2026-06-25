// main / preload / renderer 間で共有する IPC チャンネル名。
export const IPC = {
  // renderer → main (invoke)
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  CHOOSE_DIR: 'settings:chooseDir',
  GET_OVERLAY_INIT: 'overlay:init',
  CAPTURE: 'capture:rect',
  EXIT_CAPTURE: 'capture:exit',
  OPEN_SAVE_DIR: 'shell:openSaveDir',

  // main → renderer (send)
  SETTINGS_CHANGED: 'settings:changed',
  CAPTURE_DONE: 'capture:done'
} as const
