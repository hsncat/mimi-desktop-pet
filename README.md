# Mimi Desktop Pet

一个 Windows 桌面宠物。小猫动作来自 `assets/video-actions` 中的视频素材，运行时会抠除背景并显示在透明置顶窗口中。

## 运行

```powershell
npm.cmd install
npm.cmd start
```

## 打包

```powershell
npm.cmd run package
```

打包产物会输出到 `dist\win-unpacked\`。

## 操作

- 拖动小猫：移动桌宠位置。
- 点击小猫：切换到下一个视频动作。
- 悬停右上角按钮：显示关闭按钮。

## 素材

- `assets/mimi-cutout.png`：视频加载失败时的兜底图片。
- `assets/mimi.ico`：应用和快捷方式图标。
- `assets/video-actions/action-*.mp4`：桌宠动作视频。
