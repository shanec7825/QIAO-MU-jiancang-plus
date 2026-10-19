# 乔木剪藏 · 英语学习定制版

基于 [joeseesun/qiaomu-clipper](https://github.com/joeseesun/qiaomu-clipper) 最新正式版 **1.18.8**，兼容原 1.15.8 英语学习定制功能，保留 MIT 许可证。

## 保留的个人功能

- 英文单词和搭配收藏；保留原句、来源、时间戳及注释，收藏后不弹出面板。
- 普通字幕划线与表达收藏互相转换，保留注释。
- 选中表达追加到 Obsidian 日记；小标题包含「学习笔记／英语表达／AI 学习」，末尾为 `- [ ] 已掌握`。
- 选中表达发送到 AI Chat 生成多语境学习材料；回答支持 Markdown 和 HTML 导出。
- 中文翻译保存在本地，再次进入相同视频和字幕时复用；部分缓存只补译缺失段落。
- 表达与翻译沿用原存储键，并纳入全部设置导出／导入。
- 暂停视频、选中或拖动字幕时不自动回跳；继续播放并清除选文后恢复跟随。
- 保留 `unlimitedStorage` 权限，避免本地字幕、翻译和收藏触及默认约 10 MB 配额。

## 本次兼容

合入上游 1.18.8 的代码块、缩进、ASCII 图和字幕空格保留等修复。将新版「剪藏时确保文稿翻译完成」流程与原本地翻译缓存衔接，缓存完整时无需配置模型或重复翻译。上游的构建版本号、来源标识、独立版权限和文件下载能力保留。

修复 Windows 注入检查脚本的路径分隔符判断，以及 helper 复制日记附件时对只读句柄调用 fsync 导致的错误。helper 基于上游 1.16.6。

## 升级

使用 Chrome 独立版，扩展 ID 固定为 `jniolfihillilkoajpnonlbkhfkiicoo`。覆盖原先已加载目录中的程序文件，然后在 `chrome://extensions` 点击重新加载，再刷新网页并重新打开阅读模式。原目录名即使含旧版本号也可继续使用。

先备份程序文件，并在设置中导出全部设置；不要通过卸载扩展或清空浏览器数据来升级。相同扩展 ID 继续使用原收藏、划线、翻译缓存、模型配置和未保存草稿。

Windows / Linux 的助手升级命令为 `python native/install.py`，安装器沿用现有 Obsidian 库与扩展来源。用 `python native/install.py --check` 检查连接。既有识别引擎和模型目录无需删除。

## 构建和验证

Node.js 22+：`npm ci`，`npx tsc --noEmit`，`npm run build:local`。新版构建目录为 `build/production/chrome-local/`；以 scripts/build-layout.cjs 为准。上游完整说明见 [README.upstream.md](README.upstream.md) 和 [native/README.md](native/README.md)。

定制变更记录见 [CHANGELOG.custom.md](CHANGELOG.custom.md)。本机验证记录位于 `docs/custom-validation.json`；GitHub Actions 继续运行上游的前端测试、助手测试与各浏览器构建。
