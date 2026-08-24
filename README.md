# Fish Arcade

Vue 3 小游戏集合，由一个 Web 入口统一代理：

| 目录 | 用途 | 访问路径 |
| --- | --- | --- |
| `web` | 游戏目录与反向代理 | `/` |
| `arrow` | 箭序 | `/games/arrow/game` |
| `find-aemeath` | 寻找爱弥斯 | `/games/find-aemeath/game` |

游戏规则见 [Arrow 说明](arrow/arrow.md) 和 [寻找爱弥斯规则摘要](find-aemeath/docs/rules-summary.md)。

平台首页统一承载游戏题图和已解锁关卡选择，并以弹出的日历式网格展示关卡：每 5 关用线框表示一个组别，普通/困难关卡用颜色区分。游戏链接使用 `?level=<index>` 直达所选关卡；各游戏根路径也会直接进入当前进度，不再提供独立开始页。同语义操作统一使用 Lucide 图标。

## 部署结构

根目录 `compose.yaml` 是整站唯一的部署源配置。它只公开 Web 端口，两个游戏通过 Compose 内网接入。`arrow/compose.yaml` 仅用于 Arrow 独立容器验收，不是整站部署配置，也不发布宿主机端口。

当 Compose 文件从仓库目录以外运行时，通过未提交的 `FISH_SOURCE_DIR` 指向源码目录；默认值 `.` 适用于仓库目录内的本地检查。不要把机器路径写入 Compose 文件。

## 发布

```shell
cp .env.example .env
# 编辑 .env 中的远程 SSH 主机和目录
./scripts/deploy.sh
```

部署脚本只读取项目目录下未跟踪的 `.env`，配置仅在脚本进程及其子进程中生效，不会修改宿主机当前 shell 的环境变量。它会先显示 `rsync --dry-run` 差异，再同步源码、复制 Compose 配置、构建镜像、更新服务并执行健康检查。

Web 服务是平台唯一入口，具体主机和端口由部署环境提供：

- `http://<web-host>:<port>/`
- `http://<web-host>:<port>/games/arrow/game`
- `http://<web-host>:<port>/games/find-aemeath/game`
- `http://<web-host>:<port>/healthz`

## 运维

在部署主机上进入 `FISH_REMOTE_STACK_DIR` 后使用标准 `docker compose ps`、`docker compose logs` 和 `docker compose down`。README 等通用使用文档保留环境变量形式；项目固定的主机、路径和测试入口只记录在 `AGENTS.md` 等项目运维指令中。

回滚时先恢复本地源码，再重新运行发布脚本，避免远端形成无法从本地复现的版本。

## 新增游戏

1. 在 `web/src/games.ts` 登记入口与题图，并在 `web/src/progress.ts` 登记本地进度键。
2. 在根 `compose.yaml` 添加内部服务。
3. 在 `web/docker/nginx.conf` 添加 `/games/<id>/` 代理。
4. 让游戏根路径直达游戏页，并在游戏页和结果页提供返回游戏中心的入口。
