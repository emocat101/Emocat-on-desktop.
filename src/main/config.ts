import { app, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppConfig, DeepPartial, UpdateConfigResult } from '../shared/types';
import { listPetAssets } from './petAssets';

export const defaultConfig: AppConfig = {
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
    greetings: ['喵，今天也一起努力呀。', '我在桌面陪你啦。', '要摸摸我吗？'],
    interactions: ['呼噜呼噜。', '喵呜，开心！', '再点一下试试？', '我会乖乖陪着你。'],
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

export function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

export async function ensureConfig(): Promise<AppConfig> {
  const configPath = getConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return mergeConfig(defaultConfig, JSON.parse(raw) as DeepPartial<AppConfig>);
  } catch {
    await writeConfig(defaultConfig);
    return defaultConfig;
  }
}

export async function writeConfig(config: AppConfig) {
  await fs.writeFile(getConfigPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export async function updateConfig(patch: DeepPartial<AppConfig>): Promise<UpdateConfigResult> {
  const current = await ensureConfig();
  const config = mergeConfig(current, patch);
  await writeConfig(config);
  const pets = await listPetAssets();
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('config:changed', { config, pets });
  });
  return {
    config,
    pets
  };
}

export function mergeConfig(base: AppConfig, patch: DeepPartial<AppConfig>): AppConfig {
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
