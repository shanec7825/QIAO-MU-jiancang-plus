# 乔木剪藏 · 英语学习定制版

基于 [joeseesun/qiaomu-clipper](https://github.com/joeseesun/qiaomu-clipper) 的正式版本 **1.15.8**，保留上游 MIT 许可证。此仓库维护个人英语学习功能的定制改动，当前版本名称为 **1.15.8 · 英语表达定制版 4**。

## 新增功能

- 暂停视频或选中字幕文字时停止自动跟随滚动，避免手动滚动后 10 秒回跳；继续播放并清除选文后可正常跟随。

- 字幕中收藏英文单词或搭配，保留原句、来源、时间戳与自己的释义；收藏后更新标记和数量，不弹出面板。
- 在英语表达面板中将普通字幕划线与表达收藏互相转换，保留注释；支持当前字幕中可明确定位的单句英文，长度 1–180 字符。
- 勾选表达追加到 Obsidian 日记，标题保留时间和来源并标识「学习笔记／英语表达／AI 学习」，末尾加入 `- [ ] 已掌握`。
- 将选中表达填入 AI Chat 的多语境学习提示词，手动发送后生成释义、不同场景例句、易错点和练习；回答可导出 Markdown 或静态 HTML。
- 字幕中文翻译逐批保存到扩展本地存储。再次进入相同来源、加载相同字幕并开启中文翻译时直接复用；完整缓存无需调用 AI，部分缓存只补译缺失段落。
- 表达和本地翻译纳入全部设置的导出与导入。

字幕内容或时间戳改变后重新翻译，防止复用不匹配的结果。升级前仅存于 Obsidian 文档中的翻译不会自动读回，首次需重新翻译以建立缓存。

## 安装

1. 从 [Releases 发布页](https://github.com/shanec7825/QIAO-MU-jiancang-plus/releases/tag/v1.15.8-english-learning.4) 下载 Chrome local ZIP 并解压；仓库的 `packages/` 目录也保留同一安装包。
2. 在 Chrome 打开 `chrome://extensions`，开启开发者模式，选择「加载已解压的扩展程序」。
3. 已有本地版建议保留原扩展目录，将新文件覆盖进去并点击「重新加载」，然后重新打开阅读模式。固定扩展 ID 为 `jniolfihillilkoajpnonlbkhfkiicoo`。
4. 按 [native/README.md](native/README.md) 安装 **1.15.8** 的本地 helper，并选择 Obsidian 笔记库。此次定制不更改 helper 协议。

勿通过卸载来升级，以免丢失扩展本地数据；升级前可在设置页导出全部设置。备份可能包含模型凭据，请自行保管。

## 从源码构建

使用 Node.js 22 或更高版本：

```sh
npm ci
npx tsc --noEmit
npm run build:local
```

构建目录为 `dist_local/`，压缩包生成到 `builds/`。构建保留上游的公开 manifest key，扩展 ID 不变。

## 验证

已通过 122 项相关测试、TypeScript 类型检查和 Chrome 本地版构建。隔离浏览器验证了收藏不弹窗、表达与划线互换、日记类型和勾选框、AI 导出，以及整页重载后从本地恢复中文翻译且不再调用 AI。测试使用模拟日记助手和模型。

仓库同步时补齐旧测试的浏览器事件模拟，全量 **924 项测试**已通过。GitHub Actions 使用 Node.js 22 运行全量测试和构建。

```sh
npx vitest run src/utils/translation-cache.test.ts src/utils/english-expressions.test.ts src/utils/learning-record.test.ts src/utils/learning-composer.test.ts src/utils/chat-export.test.ts src/utils/local-backup.test.ts src/utils/clip-chat-setup.test.ts src/utils/highlighter.test.ts src/utils/reader-preview-shell.test.ts src/utils/youtube-study.test.ts src/utils/youtube-translation.test.ts src/utils/transcript-export.test.ts
```

## 来源和更新

- 上游完整说明保留于 [README.upstream.md](README.upstream.md)。
- 定制更新记录见 [CHANGELOG.custom.md](CHANGELOG.custom.md)。
- 仓库中的首次提交是上游 v1.15.8 源码快照，第二次提交包含本次定制功能与安装包。
- 后续修改源码、运行测试和 `npm run build:local`，更新 `packages/` 内安装包后提交并推送到本仓库。
- 每次推送 `main` 会运行定制验证并上传 Chrome local 构建产物；不自动覆盖本机安装目录。
