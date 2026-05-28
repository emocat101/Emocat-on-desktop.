import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureConfig, updateConfig } from './config';
import { importPetAsset, listPetAssets, previewAction } from './petAssets';
import { AppConfig, DeepPartial, WindowPosition } from '../shared/types';

let petWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let cachedConfig: AppConfig | null = null;
let isQuitting = false;
let followCursorTimer: NodeJS.Timeout | null = null;

const isDev = !app.isPackaged;

app.setName('猫猫桌面宠物');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  showPetWindow();
  showSettingsWindow();
});

app.whenReady().then(async () => {
  cachedConfig = await ensureConfig();
  createTray();
  await createPetWindow();
  registerIpc();
  registerShortcuts();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (isQuitting) {
    app.quit();
  }
});

async function createPetWindow() {
  const config = cachedConfig ?? (await ensureConfig());
  const { width, height } = getPetWindowSize(config);
  const position = config.pet.position ?? getDefaultPetPosition(width, height);

  petWindow = new BrowserWindow({
    width,
    height,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.loadURL(getRendererUrl('pet'));
  petWindow.once('ready-to-show', () => {
    if (config.pet.enabled) {
      petWindow?.showInactive();
    }
    syncFollowCursor(config);
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 920,
    minHeight: 640,
    show: false,
    title: '猫猫桌面宠物后台',
    backgroundColor: '#f7f4ef',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  settingsWindow.loadURL(getRendererUrl('settings'));
  settingsWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      settingsWindow?.hide();
    }
  });

  return settingsWindow;
}

function showSettingsWindow() {
  const window = createSettingsWindow();
  window.once('ready-to-show', () => window.show());
  if (window.isVisible()) {
    window.focus();
  } else {
    window.show();
  }
}

function showPetWindow() {
  if (!petWindow || petWindow.isDestroyed()) {
    void createPetWindow();
    return;
  }

  petWindow.showInactive();
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('猫猫桌面宠物');
  refreshTrayMenu();
}

function refreshTrayMenu() {
  const isPetVisible = Boolean(petWindow?.isVisible());
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开后台面板',
      click: () => showSettingsWindow()
    },
    {
      label: isPetVisible ? '隐藏小猫' : '显示小猫',
      click: () => {
        if (petWindow?.isVisible()) {
          petWindow.hide();
        } else {
          showPetWindow();
        }
        refreshTrayMenu();
      }
    },
    {
      label: '切换陪伴模式',
      submenu: [
        { label: '陪伴模式', click: () => void applyConfig({ pet: { mode: 'companion' } }) },
        { label: '睡觉模式', click: () => void applyConfig({ pet: { mode: 'sleep' } }) },
        { label: '活跃模式', click: () => void applyConfig({ pet: { mode: 'active' } }) },
        { label: '安静模式', click: () => void applyConfig({ pet: { mode: 'quiet' } }) }
      ]
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray?.setContextMenu(contextMenu);
}

function registerIpc() {
  ipcMain.handle('config:get', () => ensureConfig());
  ipcMain.handle('config:update', async (_event, patch: DeepPartial<AppConfig>) => applyConfig(patch));
  ipcMain.handle('assets:list', () => listPetAssets());
  ipcMain.handle('assets:import', (_event, sourcePath?: string) => importPetAsset(sourcePath));
  ipcMain.handle('assets:preview', (_event, petId: string, actionName: string) => previewAction(petId, actionName));
  ipcMain.handle('settings:show', () => showSettingsWindow());
  ipcMain.handle('pet:visible', async (_event, visible: boolean) => {
    if (visible) {
      showPetWindow();
    } else {
      petWindow?.hide();
    }
    refreshTrayMenu();
  });
  ipcMain.handle('pet:move', (_event, position: WindowPosition) => {
    petWindow?.setPosition(Math.round(position.x), Math.round(position.y), false);
  });
  ipcMain.handle('pet:save-position', async (_event, position: WindowPosition) => {
    const result = await applyConfig({ pet: { position } });
    return result.config;
  });
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Alt+C', () => {
    if (petWindow?.isVisible()) {
      petWindow.hide();
    } else {
      showPetWindow();
    }
    refreshTrayMenu();
  });
  globalShortcut.register('CommandOrControl+Alt+S', () => showSettingsWindow());
}

async function applyConfig(patch: DeepPartial<AppConfig>) {
  const result = await updateConfig(patch);
  cachedConfig = result.config;
  applyPetWindowConfig(result.config);
  syncFollowCursor(result.config);
  app.setLoginItemSettings({
    openAtLogin: result.config.display.startAtLogin
  });
  refreshTrayMenu();
  return result;
}

function applyPetWindowConfig(config: AppConfig) {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  const { width, height } = getPetWindowSize(config);
  const [x, y] = petWindow.getPosition();
  petWindow.setBounds({ x, y, width, height }, false);
  petWindow.setOpacity(config.display.opacity);
  if (config.pet.enabled) {
    petWindow.showInactive();
  } else {
    petWindow.hide();
  }
}

function getRendererUrl(route: 'pet' | 'settings') {
  if (isDev) {
    return `http://127.0.0.1:5173/#/${route}`;
  }

  const indexPath = path.join(__dirname, '../../dist-renderer/index.html');
  return `${pathToFileURL(indexPath).toString()}#/${route}`;
}

function getPetWindowSize(config: AppConfig) {
  const size = Math.max(96, Math.min(320, config.display.size));
  return {
    width: size + 64,
    height: size + 86
  };
}

function getDefaultPetPosition(width: number, height: number) {
  const display = screen.getPrimaryDisplay().workArea;
  return {
    x: display.x + display.width - width - 28,
    y: display.y + display.height - height - 28
  };
}

function createTrayIcon() {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#F7B267"/>
      <path d="M9 15 6 8l7 4h6l7-4-3 7a9 9 0 1 1-14 0Z" fill="#5C4033"/>
      <circle cx="13" cy="18" r="1.6" fill="#fff"/>
      <circle cx="20" cy="18" r="1.6" fill="#fff"/>
      <path d="M15.5 21.5c1 1 2 1 3 0" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    </svg>
  `);

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=UTF-8,${svg}`);
}

function syncFollowCursor(config: AppConfig) {
  if (followCursorTimer) {
    clearInterval(followCursorTimer);
    followCursorTimer = null;
  }

  if (!config.interactions.followCursor) {
    return;
  }

  followCursorTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) {
      return;
    }

    const cursor = screen.getCursorScreenPoint();
    const bounds = petWindow.getBounds();
    const targetX = cursor.x + 24;
    const targetY = cursor.y + 22;
    const nextX = Math.round(bounds.x + (targetX - bounds.x) * 0.18);
    const nextY = Math.round(bounds.y + (targetY - bounds.y) * 0.18);
    petWindow.setPosition(nextX, nextY, false);
  }, 120);
}
