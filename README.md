# Mimi Desktop Pet

一个用 `C:\Users\hansh\Desktop\咪咪.png` 做成的 Windows 桌面宠物。

## 运行

```powershell
npm.cmd start
```

## 重新生成小猫素材

```powershell
npm.cmd run prepare-assets
```

也可以传入另一张图片：

```powershell
npm.cmd run prepare-assets -- "C:\path\to\cat.png"
```

## 打包

```powershell
npm.cmd run package
```

打包产物会输出到 `dist\win-unpacked\`。

## 操作

- 拖动小猫：移动桌宠位置。
- 点击小猫：触发弹跳、气泡和爱心。
- 悬停右上角按钮：关闭桌宠。

## 动作

咪咪会自动随机切换这些动作：

- 待机呼吸
- 舔爪子
- 趴着打盹
- 甩尾巴
- 被拖动时晃晃
