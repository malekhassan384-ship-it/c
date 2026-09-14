/**
 * Secure IPC bridge — the ONLY surface exposed to the renderer.
 * sandbox: true compatible (no Node APIs beyond contextBridge/ipcRenderer).
 */
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  settings: {
    get: (): Promise<unknown> => ipcRenderer.invoke('settings:get'),
    set: (value: unknown): Promise<unknown> => ipcRenderer.invoke('settings:set', value)
  },
  history: {
    list: (): Promise<unknown> => ipcRenderer.invoke('history:list'),
    save: (record: unknown): Promise<unknown> => ipcRenderer.invoke('history:save', record),
    remove: (id: string): Promise<unknown> => ipcRenderer.invoke('history:delete', id)
  },
  progress: {
    get: (): Promise<unknown> => ipcRenderer.invoke('progress:get'),
    puzzleSolved: (payload: unknown): Promise<unknown> => ipcRenderer.invoke('progress:puzzleSolved', payload),
    lessonCompleted: (payload: unknown): Promise<unknown> => ipcRenderer.invoke('progress:lessonCompleted', payload),
    reset: (): Promise<unknown> => ipcRenderer.invoke('progress:reset')
  },
  achievements: {
    get: (): Promise<unknown> => ipcRenderer.invoke('achievements:get'),
    onUnlocked: (cb: (ids: string[]) => void): (() => void) => {
      const listener = (_e: unknown, ids: string[]) => cb(ids);
      ipcRenderer.on('achievements:unlocked', listener);
      return () => ipcRenderer.removeListener('achievements:unlocked', listener);
    }
  },
  engine: {
    getInfo: (): Promise<unknown> => ipcRenderer.invoke('engine:getInfo'),
    analyze: (payload: unknown): Promise<unknown> => ipcRenderer.invoke('engine:analyze', payload),
    stop: (): Promise<unknown> => ipcRenderer.invoke('engine:stop')
  },
  app: {
    getMeta: (): Promise<unknown> => ipcRenderer.invoke('app:getMeta'),
    resetData: (): Promise<unknown> => ipcRenderer.invoke('app:resetData'),
    licenseNotice: (): Promise<unknown> => ipcRenderer.invoke('app:openLicense'),
    ready: (): void => { ipcRenderer.send('app:ready'); }
  }
};

contextBridge.exposeInMainWorld('chessVanguard', api);
