export type PetMode = 'companion' | 'sleep' | 'active' | 'quiet';

export type PetActionName = 'idle' | 'walk' | 'sleep' | 'happy' | 'touch' | 'eat' | string;

export type AssetSource = 'built-in' | 'user';

export interface WindowPosition {
  x: number;
  y: number;
}

export interface PetAction {
  name: PetActionName;
  label: string;
  type: 'animated' | 'sprite' | 'generated';
  fps: number;
  loop: boolean;
  files: string[];
  triggers: string[];
}

export interface PetAsset {
  id: string;
  name: string;
  description?: string;
  author?: string;
  source: AssetSource;
  basePath: string;
  actions: PetAction[];
}

export interface SpeechConfig {
  greetings: string[];
  interactions: string[];
  idle: string[];
}

export interface InteractionConfig {
  clickAction: PetActionName;
  doubleClickAction: PetActionName;
  rightClickOpensMenu: boolean;
  followCursor: boolean;
  idleAfterSeconds: number;
}

export interface DisplayConfig {
  size: number;
  opacity: number;
  bubbleEnabled: boolean;
  startAtLogin: boolean;
}

export interface PetConfig {
  activePetId: string;
  mode: PetMode;
  enabled: boolean;
  position: WindowPosition | null;
}

export interface AppConfig {
  pet: PetConfig;
  display: DisplayConfig;
  speech: SpeechConfig;
  interactions: InteractionConfig;
}

export interface PetPreview {
  petId: string;
  actionName: PetActionName;
  action: PetAction | null;
}

export interface UpdateConfigResult {
  config: AppConfig;
  pets: PetAsset[];
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer _U> ? T[P] : T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface DesktopPetApi {
  getConfig: () => Promise<AppConfig>;
  updateConfig: (patch: DeepPartial<AppConfig>) => Promise<UpdateConfigResult>;
  listPetAssets: () => Promise<PetAsset[]>;
  importPetAsset: (sourcePath?: string) => Promise<PetAsset[]>;
  previewAction: (petId: string, actionName: PetActionName) => Promise<PetPreview>;
  movePet: (position: WindowPosition) => Promise<void>;
  savePosition: (position: WindowPosition) => Promise<AppConfig>;
  showSettings: () => Promise<void>;
  setPetVisible: (visible: boolean) => Promise<void>;
  onConfigChanged: (callback: (payload: UpdateConfigResult) => void) => () => void;
}
