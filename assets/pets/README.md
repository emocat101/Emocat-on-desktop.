# 猫猫素材包格式

每个素材包是一个文件夹，至少包含 `pet.json`：

```json
{
  "id": "my-cat",
  "name": "我的小猫",
  "description": "可选描述",
  "author": "可选作者",
  "actions": [
    {
      "name": "idle",
      "label": "待机",
      "path": "actions/idle",
      "fps": 8,
      "loop": true
    }
  ]
}
```

动作目录支持 `gif`、`apng`、`webp`、`png`、`jpg`、`jpeg`、`svg`。如果目录内是 `gif/apng/webp`，应用会按单文件动图播放；如果目录内是多张图片，会按文件名排序作为序列帧播放。

推荐动作名：`idle`、`walk`、`sleep`、`happy`、`touch`、`eat`。
