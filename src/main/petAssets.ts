import { app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AssetSource, PetAction, PetAsset, PetActionName, PetPreview } from '../shared/types';

interface PetManifest {
  id: string;
  name: string;
  description?: string;
  author?: string;
  actions: Array<{
    name: PetActionName;
    label?: string;
    type?: PetAction['type'];
    fps?: number;
    loop?: boolean;
    path?: string;
    triggers?: string[];
  }>;
}

const supportedImagePattern = /\.(gif|apng|webp|png|jpg|jpeg|svg)$/i;
const animatedPattern = /\.(gif|apng|webp)$/i;

export function getBuiltInAssetsPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'pets')
    : path.join(app.getAppPath(), 'assets', 'pets');
}

export function getUserAssetsPath() {
  return path.join(app.getPath('userData'), 'pets');
}

export async function listPetAssets(): Promise<PetAsset[]> {
  await fs.mkdir(getUserAssetsPath(), { recursive: true });
  const [builtIn, user] = await Promise.all([
    scanAssetRoot(getBuiltInAssetsPath(), 'built-in'),
    scanAssetRoot(getUserAssetsPath(), 'user')
  ]);

  return [...builtIn, ...user];
}

export async function importPetAsset(sourcePath?: string): Promise<PetAsset[]> {
  const selected = sourcePath ?? (await selectAssetFolder());
  if (!selected) {
    return listPetAssets();
  }

  const manifest = await readManifest(selected);
  const target = path.join(getUserAssetsPath(), manifest.id);
  await copyDirectory(selected, target);
  return listPetAssets();
}

export async function previewAction(petId: string, actionName: PetActionName): Promise<PetPreview> {
  const pets = await listPetAssets();
  const pet = pets.find((item) => item.id === petId);
  const action = pet?.actions.find((item) => item.name === actionName) ?? null;

  return {
    petId,
    actionName,
    action
  };
}

async function selectAssetFolder() {
  const result = await dialog.showOpenDialog({
    title: '选择猫猫素材包文件夹',
    properties: ['openDirectory']
  });

  return result.canceled ? null : result.filePaths[0];
}

async function scanAssetRoot(root: string, source: AssetSource): Promise<PetAsset[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const pets = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => scanPetDirectory(path.join(root, entry.name), source))
    );

    return pets.filter(Boolean) as PetAsset[];
  } catch {
    return [];
  }
}

async function scanPetDirectory(directory: string, source: AssetSource): Promise<PetAsset | null> {
  try {
    const manifest = await readManifest(directory);
    const actions = await Promise.all(
      manifest.actions.map((action) => hydrateAction(directory, action))
    );

    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      author: manifest.author,
      source,
      basePath: directory,
      actions
    };
  } catch {
    return null;
  }
}

async function readManifest(directory: string): Promise<PetManifest> {
  const raw = await fs.readFile(path.join(directory, 'pet.json'), 'utf8');
  const manifest = JSON.parse(raw) as PetManifest;
  if (!manifest.id || !manifest.name || !Array.isArray(manifest.actions)) {
    throw new Error('Invalid pet manifest');
  }

  return manifest;
}

async function hydrateAction(directory: string, action: PetManifest['actions'][number]): Promise<PetAction> {
  const actionPath = path.join(directory, action.path ?? path.join('actions', String(action.name)));
  const files = await readActionFiles(actionPath);
  const hasAnimatedFile = files.some((file) => animatedPattern.test(file));

  return {
    name: action.name,
    label: action.label ?? String(action.name),
    type: action.type ?? (hasAnimatedFile ? 'animated' : files.length ? 'sprite' : 'generated'),
    fps: action.fps ?? 8,
    loop: action.loop ?? true,
    files,
    triggers: action.triggers ?? []
  };
}

async function readActionFiles(actionPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(actionPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && supportedImagePattern.test(entry.name))
      .map((entry) => pathToFileURL(path.join(actionPath, entry.name)).toString())
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function copyDirectory(source: string, target: string) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const from = path.join(source, entry.name);
      const to = path.join(target, entry.name);
      if (entry.isDirectory()) {
        await copyDirectory(from, to);
      } else if (entry.isFile()) {
        await fs.copyFile(from, to);
      }
    })
  );
}
