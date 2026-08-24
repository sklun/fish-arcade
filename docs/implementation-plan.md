# 整站集成任务计划

## 当前阶段

共享入口、模块代码、配置和文档已完成；暂停层视觉已统一，待在目标部署环境执行整站回归。

## 阶段

| 阶段 | 目标 | 范围 | 依赖 | 验收标准 | 验证命令 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 确认共享关卡入口契约 | 平台进度读取、游戏直达地址与返回平台行为 | 无 | 三个模块使用一致的关卡编号和入口约定 | 模块计划交叉检查 | completed |
| 2 | 同步整站文档 | `README.md` 与模块文档链接 | Web、Arrow、Find Aemeath 模块任务 | 文档只描述当前入口、部署和用户流程 | Markdown 定向检查 | completed |
| 3 | 执行整站验收 | Compose 部署与浏览器流程 | 阶段 2 | Web 唯一入口、两款游戏直达流程、健康检查及桌面/移动端布局通过 | 容器化部署与 Playwright | pending |

## 模块计划

- Web 平台：[../web/docs/implementation-plan.md](../web/docs/implementation-plan.md)
- Arrow：[../arrow/docs/implementation-plan.md](../arrow/docs/implementation-plan.md)
- Find Aemeath：[../find-aemeath/docs/implementation-plan.md](../find-aemeath/docs/implementation-plan.md)

## 当前约束

- Web 服务是唯一平台入口，部署地址由环境配置提供。
- 根计划只跟踪共享契约和最终集成，不重复记录模块实现过程。
- 整站验收使用容器执行，不把环境地址、账号或路径写入仓库。

## 当前验证

- Web、Arrow 和 Find Aemeath 的类型检查与生产构建已在容器中完成。
- 模块单元测试已在容器中完成；整站浏览器回归待部署环境执行。
- 本次暂停层改动已完成静态差异检查；当前工作区没有本地依赖，且远程源码同步验证受权限策略限制，未重复执行容器构建。

## 下一阶段

- 在配置好的部署环境执行整站 Playwright 与桌面/移动视觉验收。
