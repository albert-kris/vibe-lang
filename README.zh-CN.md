# vibe-lang

**面向 AI 维护代码的语言与工具链。**

[English](./README.md) · [语言规范](./docs/spec.md) · 许可证：Apache-2.0

---

## 要解决的问题

今天指挥 AI 改代码的方式是聊天。聊天适合表达一次性需求，但作为工程资产是灾难：

- 需求散落在聊天记录里，没法 review，没法复用
- AI 自己决定动哪些文件，“别碰支付代码”只是祈祷，不是保证
- “改完了”全凭 AI 自己说，没有机械化的验收
- 半年后没人知道这段代码当初为什么改、边界是什么

未来程序员的核心工作不再是手写代码，而是**用 AI 维护代码**。那么稀缺的能力就变成：**把模糊需求写成 AI 能执行、机器能验证的精确变更说明**。vibe-lang 就是给这件事配的语言。

## 核心思想

把“变更意图”做成有类型、可版本管理、可执行的文件——**Vibefile**：

```text
自然语言          ── prompt 层（快，给人用）
    ↓
change 声明       ── spec 层（可审查、进 git    ← Vibefile）
    ↓
plan.json + 提示词 ── 合同层（确定性编译）
    ↓
AI 执行器改代码    ── 执行层（任意 agent CLI，不被信任）
    ↓
边界 + 验收检查    ── 强制层（确定性校验，可做 CI 门禁）
```

类比基础设施文件：

| 文件 | 编码的内容 |
|---|---|
| `Dockerfile` | 容器怎么构建 |
| `Makefile` | 任务怎么执行 |
| `*.tf` | 基础设施怎么创建 |
| **`*.vibe`** | **AI 被允许怎样修改软件** |

两条设计铁律：

1. **编译器和校验器永不调用 LLM。** 同样输入永远同样输出。
2. **AI 执行器不被信任。** 文件边界在执行后对照真实 `git` diff 强制检查，不听 AI 的自我汇报。

## Vibefile 长什么样

```vibe
change "add product search" {
  goal "在首页商品列表增加按标题搜索"

  scope {
    allow "src/app/page.tsx"
    allow "src/components/**"
    allow "src/lib/queries.ts"

    forbid "src/app/api/payment/**"   // 无论如何不许碰
    forbid "prisma/**"                // 本次变更不许改数据库结构
  }

  requirements {
    "商品列表顶部显示搜索输入框"
    "按 title 过滤，不区分大小写"
    "搜索词通过 URL 参数 q 表示"
  }

  constraints {
    "不新增 npm 依赖"
    "GET /api/products 响应结构保持不变"
  }

  acceptance {
    "输入关键词后列表只剩匹配项"
    "刷新页面后搜索词仍在"
    run "npx tsc --noEmit"
    run "npm test"
  }

  rollback revert
}
```

语法刻意做小：一种声明、六个块、十来个关键字。裸字符串就是默认行为——
requirement 默认 `add`，acceptance 默认行为检查（`test`）；只有命令需要显式
`run`。意图不同时再加 `remove` / `modify` 前缀。

没有 `scope`、没有 `requirements`、没有 `acceptance`，或者同一模式既 allow 又 forbid——**直接编译失败**。模糊的变更计划就是被拒绝的变更计划。

## 快速开始

```bash
npm install        # 当前从源码克隆使用；npm 发布在路线图中
npm run build
npm link           # 获得全局 vibe 命令
```

在你要维护的仓库里：

```bash
vibe init
# .vibe/config.json           执行器配置
# .vibe/changes/example.vibe  第一个 Vibefile（这个目录要进版本管理）
```

在 `.vibe/config.json` 里配置执行器——任何 AI 编程 CLI 都行：

```json
{
  "executor": "cursor-agent -p \"$(cat {promptFile})\" --force",
  "maxAttempts": 2
}
```

然后一条命令执行变更：

```bash
vibe run .vibe/changes/add-search.vibe
```

发生的事情：

1. 编译 Vibefile 并做静态检查，产出 `plan.json` 和确定性的执行合同（提示词）
2. 要求工作区干净（这样 diff 就精确等于 AI 的改动）
3. 执行器在仓库内按合同干活
4. 校验器逐文件比对 allow/forbid，逐条执行验收命令
5. 失败则把失败报告拼回提示词重试（最多 `maxAttempts` 次）；最终失败且 `rollback revert` 时还原已跟踪文件

没配执行器？`vibe run` 自动退化为手动模式：打印提示词路径（粘给任何 AI 工具）和事后校验命令。

### 当 CI 门禁用

```bash
vibe verify .vibe/runs/add-product-search/plan.json --repo . --json
```

只有“零越界 + 全部验收命令通过”才返回退出码 0——直接挂进 CI，AI 写的 PR 越界就合不进去。

## 命令一览

| 命令 | 作用 |
|---|---|
| `vibe init` | 在仓库里初始化 `.vibe/` |
| `vibe compile <file.vibe>` | 编译 change 声明 → plan.json + 执行合同 |
| `vibe run <change.vibe>` | 端到端执行变更（编译 → AI → 校验 → 重试） |
| `vibe verify <plan.json> --repo <dir>` | 对照变更计划强制检查 git 工作区 |
| `vibe generate <app.vibe>` | 从 `app` 声明生成项目骨架（次要能力） |

## 仓库约定

```text
.vibe/
  config.json     执行器 + 重试预算        （进版本管理）
  changes/*.vibe  变更意图文件             （进版本管理——这就是工程资产）
  build/          编译产物                 （gitignore）
  runs/           运行记录与校验报告        （gitignore）
```

Vibefile 像普通源码一样走 PR review。`.vibe/changes/` 的提交历史，就是这个项目机器可读的意图史：谁改了什么、边界在哪、怎么验证的。

## 谁来维护 Vibefile？

普通用户说自然语言，由助手起草 Vibefile；而我们预期会出现的新角色——**Vibe Coding 工程师**——负责审查和维护 spec 层：

```text
普通用户        ："加个搜索，别动支付代码"
Vibe 工程师     ：审查 scope、收紧验收标准、把 Vibefile 入库
AI 执行器       ：在合同内改代码
校验器 + CI     ：证明合同被遵守
```

类比：大多数人不手写 SQL 和 Dockerfile，但数据库和部署离不开它们。

## 路线图

- [ ] `test` 验收条目自动化（落到 Playwright/E2E）
- [ ] `constraints` 机器检查（依赖 diff、migration diff）
- [ ] 执行中实时拦截越界写入（executor hook，不止事后检测）
- [ ] 自然语言 → Vibefile 草稿（schema 约束的 LLM 输出）
- [ ] 多变更编排与依赖排序
- [ ] VS Code 扩展（Langium LSP：补全、诊断、悬停）
- [ ] 发布 npm 包

## 贡献与许可

贡献指南见 [CONTRIBUTING.md](./CONTRIBUTING.md)；许可证 [Apache-2.0](./LICENSE)。
