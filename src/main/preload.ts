import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig, DeepPartial, DesktopPetApi, PetActionName, UpdateConfigResult, WindowPosition } from '../shared/types';

const api: DesktopPetApi = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (patch: DeepPartial<AppConfig>) => ipcRenderer.invoke('config:update', patch),
  listPetAssets: () => ipcRenderer.invoke('assets:list'),
  importPetAsset: (sourcePath?: string) => ipcRenderer.invoke('assets:import', sourcePath),
  previewAction: (petId: string, actionName: PetActionName) => ipcRenderer.invoke('assets:preview', petId, actionName),
  movePet: (position: WindowPosition) => ipcRenderer.invoke('pet:move', position),
  savePosition: (position: WindowPosition) => ipcRenderer.invoke('pet:save-position', position),
  showSettings: () => ipcRenderer.invoke('settings:show'),
  setPetVisible: (visible: boolean) => ipcRenderer.invoke('pet:visible', visible),
  onConfigChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload as UpdateConfigResult);
    ipcRenderer.on('config:changed', listener);
    return () => ipcRenderer.removeListener('config:changed', listener);
  }
};

contextBridge.exposeInMainWorld('desktopPet', api);
