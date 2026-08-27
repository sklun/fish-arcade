# 箭序（Arrow）

箭序是响应式顺序解谜游戏。玩家按可解顺序点击箭头，让所有折线离开棋盘；支持鼠标、触摸和键盘。

## 规则

- 箭头由有序逻辑格点组成，最后一个点是箭头端。
- 点击后，箭头端沿朝向前进一格，其余点依次跟随前一个点，形成蛇形移动。
- 移动轨迹与其他存活箭头重叠时，本次移动撤销并扣 1 条生命。
- 箭头全部离开可玩区域后移除；清空全部箭头即通关。
- 生命归零或倒计时结束时失败，可用同一关卡重新开始。
- 每关有 3 次提示，每次高亮一个当前可移出的箭头 1.5 秒。

规则层支持上、右上、右、右下、下、左下、左、左上 8 个方向。斜向移动使用超覆盖碰撞检查，目标格旁任一正交中间格被占用都视为碰撞。当前生成器使用水平和垂直折线及四个正交出口，8 方向能力由规则测试覆盖。

## 关卡

| 难度 | 棋盘      | 生命 |   时限 |
|------|-----------|-----:|-------:|
| 普通 | `30 x 40` |    3 | 180 秒 |
| 困难 | `30 x 40` |    2 | 210 秒 |

- 每 5 关一个循环：前 4 关普通，第 5 关困难。
- 棋盘使用完整的 `30 x 40` 点阵；每个格点恰好属于一条路径。
- 生成器严格按参考算法执行中心向外随机游走、单点修复、数量收敛和依赖环消解，目标路径数为 `100`，最终路径数必须在 `[80, 120]` 内。
- 同一关卡始终使用相同确定性种子生成相同布局；生成流程保留 `5` 个边缘出口候选供校验。
- 每条路径至少含 2 个格点，路径只使用上、右、下、左四个正交步进；求解器严格按渲染后的固定末端方向逐轮抽取，不翻转路径，并再次验证完整解。

## 状态与操作

状态流转为：

```text
platform -> playing <-> paused
playing -> success -> playing（下一关）
playing -> failed -> playing（重试）
playing -> platform
```

- 点击、触摸或聚焦箭头后按 `Enter`/`Space` 可移动箭头。
- `H` 使用提示，`P` 暂停；动画期间锁定输入。
- 暂停会停止倒计时并禁止棋盘输入。
- 碰撞反馈结束后才扣除一次操作结果，箭头位置保持不变。
- 支持深色/浅色主题、音效和 `prefers-reduced-motion`。

## 数据与持久化

核心类型位于 `src/game/model.ts`，移动、生成和求解逻辑位于 `src/game/`，不依赖 Vue。Pinia store 负责计时、生命、提示、动画和页面状态。

`localStorage` 键 `arrow.progress.v1` 保存最高关卡、主题和音效设置。运行中的棋盘、剩余时间和生命不会恢复。

平台读取最高关卡并提供已解锁关卡选择，通过 `/games/arrow/game?level=<index>` 直达棋盘；游戏根路径直接进入当前最高进度。超出已解锁范围的关卡参数会被限制到最高可玩关卡。

## 部署

- Vite 和 Vue Router 基路径为 `/games/arrow/`。
- Nginx 提供 SPA history fallback、`/healthz` 和静态资源缓存。
- 根目录 `compose.yaml` 是整站部署源配置，Arrow 只在 Compose 内网暴露 80 端口。
- `arrow/compose.yaml` 仅供独立容器验收，不映射宿主机端口。

## 验证基线

`npm run check` 依次执行 Vitest、类型检查/生产构建和 Playwright。重点覆盖 8 方向与斜向碰撞、确定性生成、可解性、4+1 进度、生命/计时/提示以及桌面和移动端流程。项目测试按仓库约定在容器中运行。

测试工具使用 `compose.test.yaml`：依赖由 `Dockerfile.test` 的独立层安装，源码通过绑定挂载导入，`node_modules` 由 Compose 卷持久化。首次运行或 `package-lock.json` 变化时构建测试镜像，之后可直接重复执行：

```shell
docker compose -f compose.test.yaml build
docker compose -f compose.test.yaml run --rm arrow-test npm run test:unit
docker compose -f compose.test.yaml run --rm arrow-test npm run typecheck
docker compose -f compose.test.yaml run --rm arrow-test npm run build
```
