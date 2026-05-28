# 猫猫桌面宠物

一个 Windows 优先的桌面宠物产品框架。小猫使用透明置顶窗口覆盖在其他页面之上，支持拖拽、模式切换、互动动作、随机台词和本地后台配置。

## 技术栈

- Electron：透明置顶桌宠窗口、后台面板窗口、托盘、快捷键、本地文件访问。
- React + TypeScript：桌宠渲染、后台面板、互动状态。
- Vite：前端开发和构建。
- JSON + 本地素材文件夹：保存配置、语句、模式、素材包。

## 功能

- 透明无边框桌宠窗口，默认显示在桌面右下角。
- 桌宠窗口始终置顶，支持拖拽移动并保存位置。
- 内置陪伴、睡觉、活跃、安静四种模式。
- 点击、双击、右键、空闲触发不同动作和语句。
- 后台面板支持素材导入、动作预览、模式切换、语句编辑、尺寸和透明度调整。
- 托盘菜单支持打开后台、显示/隐藏小猫、切换模式、退出。
- 支持 GIF/APNG/WEBP 动图和 PNG/JPG/SVG 序列帧素材包。

## 开发

```bash
npm install
npm run dev
```

开发模式会启动 Vite 和 Electron。应用启动后，小猫窗口会显示，后台面板可通过托盘菜单或右键小猫打开。

如果 Electron 运行包下载很慢，可以先执行：

```bash
npm run install:electron:cn
```

## 构建

```bash
npm run build
npm run dist
```

`npm run dist` 会在 `release` 目录生成 Windows 安装包。

## 素材包

素材包格式见 [assets/pets/README.md](assets/pets/README.md)。导入的素材会复制到应用的本地数据目录，配置会保存到 Electron 的 `userData/config.json`。
