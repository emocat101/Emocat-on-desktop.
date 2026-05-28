import {
  AppConfig,
  DeepPartial,
  DesktopPetApi,
  PetActionName,
  PetAsset,
  UpdateConfigResult,
  WindowPosition
} from '../shared/types';

const previewConfigKey = 'cat-desktop-pet.preview.config';

const defaultPreviewConfig: AppConfig = {
  pet: {
    activePetId: 'mimi',
    mode: 'companion',
    enabled: true,
    position: null
  },
  display: {
    size: 168,
    opacity: 1,
    bubbleEnabled: true,
    startAtLogin: false
  },
  speech: {
    greetings: ['喵，预览模式也能陪你。', '后台面板已经醒啦。', '今天想换哪个模式？'],
    interactions: ['呼噜呼噜。', '喵呜，开心！', '这里是浏览器预览。'],
    idle: ['有点想睡觉了。', '你忙，我在。', '伸个懒腰，喵。']
  },
  interactions: {
    clickAction: 'touch',
    doubleClickAction: 'happy',
    rightClickOpensMenu: true,
    followCursor: false,
    idleAfterSeconds: 45
  }
};

const previewPets: PetAsset[] = [
  {
    id: 'mimi',
    name: '橘子咪咪',
    description: '浏览器预览里的内置动态猫猫。完整桌面覆盖能力需要在 Electron 应用中运行。',
    author: '猫猫桌面宠物',
    source: 'built-in',
    basePath: 'preview://mimi',
    actions: [
      { name: 'idle', label: '待机', type: 'generated', fps: 8, loop: true, files: [], triggers: ['mode:companion', 'idle'] },
      { name: 'walk', label: '走动', type: 'generated', fps: 10, loop: true, files: [], triggers: ['idle-random', 'follow-cursor'] },
      { name: 'sleep', label: '睡觉', type: 'generated', fps: 6, loop: true, files: [], triggers: ['mode:sleep', 'idle-random'] },
      { name: 'happy', label: '开心', type: 'generated', fps: 12, loop: true, files: [], triggers: ['double-click', 'mode:active'] },
      { name: 'touch', label: '摸摸', type: 'generated', fps: 12, loop: true, files: [], triggers: ['click'] },
      { name: 'eat', label: '喂食', type: 'generated', fps: 8, loop: true, files: [], triggers: ['manual'] }
    ]
  }
];

type Listener = (payload: UpdateConfigResult) => void;

const listeners = new Set<Listener>();

export function installPreviewApi() {
  if (window.desktopPet) {
    return;
  }

  window.desktopPet = createPreviewApi();
  document.documentElement.dataset.previewMode = 'true';
}

function createPreviewApi(): DesktopPetApi {
  return {
    getConfig: async () => readConfig(),
    updateConfig: async (patch) => {
      const config = mergeConfig(readConfig(), patch);
      writeConfig(config);
      const payload = { config, pets: previewPets };
      listeners.forEach((listener) => listener(payload));
      return payload;
    },
    listPetAssets: async () => previewPets,
    importPetAsset: async () => previewPets,
    previewAction: async (petId: string, actionName: PetActionName) => {
      const pet = previewPets.find((item) => item.id === petId);
      return {
        petId,
        actionName,
        action: pet?.actions.find((item) => item.name === actionName) ?? null
      };
    },
    movePet: async (_position: WindowPosition) => undefined,
    savePosition: async (position: WindowPosition) => {
      const config = mergeConfig(readConfig(), { pet: { position } });
      writeConfig(config);
      return config;
    },
    showSettings: async () => {
      window.location.hash = '#/settings';
    },
    setPetVisible: async (visible: boolean) => {
      const config = mergeConfig(readConfig(), { pet: { enabled: visible } });
      writeConfig(config);
    },
    onConfigChanged: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
  };
}

function readConfig(): AppConfig {
  try {
    const raw = window.localStorage.getItem(previewConfigKey);
    return raw ? mergeConfig(defaultPreviewConfig, JSON.parse(raw) as DeepPartial<AppConfig>) : defaultPreviewConfig;
  } catch {
    return defaultPreviewConfig;
  }
}

function writeConfig(config: AppConfig) {
  window.localStorage.setItem(previewConfigKey, JSON.stringify(config));
}

function mergeConfig(base: AppConfig, patch: DeepPartial<AppConfig>): AppConfig {
  return {
    pet: {
      ...base.pet,
      ...patch.pet
    },
    display: {
      ...base.display,
      ...patch.display
    },
    speech: {
      greetings: patch.speech?.greetings ?? base.speech.greetings,
      interactions: patch.speech?.interactions ?? base.speech.interactions,
      idle: patch.speech?.idle ?? base.speech.idle
    },
    interactions: {
      ...base.interactions,
      ...patch.interactions
    }
  };
}
