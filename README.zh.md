# dsh-git-plus

<div align="center">

[English](README.md) | 简体中文

</div>

DeepSeek Harness Web GUI 的 IDE 风格 Git 面板。侧栏提供 **Local Changes**（本地变更）与 **All Commits**（全部提交），以及分支 / 标签 / Stash 管理、Fetch / Pull / Push 弹窗、带冲突处理的合并，还有输入框上的 zsh 风格分支标记。

## 安装

```sh
dsh plugin --profile web add git+ssh://git@github.com/bitxeno/dsh-git-plus.git
```

包发布到 npm 后也可以用registry形式安装：

```sh
dsh plugin --profile web add dsh-git-plus
```

已有安装用同一条命令即可更新；需要固定版本时在包名后追加 `@<版本>`。安装后重启 `dsh web`（只改客户端时刷新浏览器即可）。

## 用法

面板以 **Git Plus** 标签出现在会话视图中。

**侧栏** —— 顶部导航切换 *Local Changes* 与 *All Commits*；下方是同步工具条（fetch / pull / push），再往下是可折叠的 *Branches / Tags / Stashes / Remotes* 分组：

- **Fetch** —— 选择单个远程或获取所有远程（始终 `--prune`）。
- **Pull** —— 选择远程与远程分支（默认取上游分支），显示合并目标分支，可勾选 `--rebase` 与 `--autostash`。
- **Push** —— 选择本地分支与目标 `远程/分支`（一键新建远程分支）；「建立跟踪引用（`--set-upstream`）」仅在目标为远程新分支时出现，另可选 `--tags` 与 `--force`。
- 分支行显示领先/落后计数；远端没有对应分支的行图标置灰。点击分支/标签过滤 All Commits，双击检出，右键打开行菜单（检出、合并、在此新建分支/标签、复制、删除）。
- Stash 行支持应用 / 应用并删除 / 删除（删除需二次点击确认）。

**Local Changes** —— 逐文件或批量暂存 / 取消暂存 / 放弃，提交与 amend，逐文件差异。

**All Commits** —— 带 graph 轨道的提交历史，按消息或哈希前缀搜索，按作者与时间过滤；提交详情面板包含提交正文、变更统计、逐文件差异（统一 / 对照视图、图片对比、超大差异延迟加载）、文件树与文件内容。任意提交行可直接发起建分支 / 打标签 / 检出。

**冲突** —— 合并或拉取产生冲突时出现横幅，列出冲突文件及各自的已解决状态；可在横幅上继续（`git add -A` 后提交）或中止。

输入框显示 zsh 风格的 `<仓库名> (分支)` 标记（可在设置中关闭；关闭后改为在 Git 标签旁显示状态圆点）。

## 设置

插件详情页有两个即时生效的选项：输入框分支标记开关、差异对比默认视图（统一 / 对照）。

## 配置

宿主配置写入选定 profile 的 `cordis.patch.yml`：

```yaml
- id: git-plus
  config:
    timeoutMs: 8000
    networkTimeoutMs: 300000
    maxBytes: 4194304
    maxChanges: 1000
    refreshIntervalMs: 30000
    defaultDiffView: unified
```

- `timeoutMs` 限制单条本地 git 命令（默认 8000 毫秒）。
- `networkTimeoutMs` 限制网络类命令——fetch / pull / push（默认 300000 毫秒）。
- `maxBytes` 限制单条命令的 stdout 上限（默认 4 MiB）。
- `maxChanges` 限制变更列表长度（默认 1000）。
- `refreshIntervalMs` 是快照轮询间隔（默认 30000 毫秒）。

宿主配置变更后需要重启 `dsh web`。

## 开发

```sh
npm install
npm run check         # 类型检查 + 单元测试
npm run build         # 重新构建 lib/（宿主 + 客户端 bundle）
npm run deploy:local  # 把 lib/ 同步到本地 dsh profile
```

`lib/` 随仓库提交，也是实际发布的内容；`deploy:local` 会把它同步到 `~/.dsh/profiles/web/node_modules/dsh-git-plus/lib` 供本地调试。

发布：推送一条 `chore(release): bump version to X.Y.Z` 提交——workflow 会打 `vX.Y.Z` 标签、创建 GitHub Release（发布说明由 changelogithub 生成），并在配置了 `NPM_TOKEN` secret 的情况下发布 npm。
