# 独立运行与交接

## 完整本机版

Node 24 + SQLite 标准库，无第三方运行依赖。`npm ci && npm start` 后打开 `http://127.0.0.1:4340`。服务仅接受 loopback Host 与同源请求；不是生产鉴权。全部管理动作属于本机操作者，不能直接对公网开放。

`LAB_ENABLE_MODEL=1` 才允许真实 Codex，规则回归与默认对话不隐式调用模型。调用使用已有登录、禁用工具、一次执行不自动重试，超时中断进程组；Tokens 采用实际返回，缺失留空。模型名未回传时不猜测，`LAB_MODEL` 可显式指定。两次本轮调用耗时接近 2 分钟，已记录，不称为即时客服。

`data/lab.sqlite` 保存业务档案；`data/model-runs/*.json` 保存模型提示、来源、候选、真实 usage 与终态元数据；这些不进入 Git。运行前了解模型会接收选中的公开教学资料与问题。真实客户接入必须先完成授权、隐私与脱敏。

## 公开演示

`npm run build:demo` 只复制公开源码与虚构素材到 `.demo-build`，将数据层切换到浏览器 localStorage。没有 SQLite、环境变量、模型调用或真实客户资料。知识只读，工单是本地角色模拟。清除浏览器数据会丢失。服务端权限隔离测试不等于浏览器数据不可被本机用户修改。

## 数据交接

页面导出完整 JSON，包含输入、快照、报告与状态；本机版本的 manifest 是对其他顶层字段 JSON 序列化计算的 SHA256。可用于检查传输内容是否变化，不提供签名认证。分享前检查输入，不把客户资料放入公开仓库。

没有 JSON 导入恢复。停止服务后备份完整 `data/`；恢复到一个新目录，以 `LAB_DATA_DIR` 指定启动，再核对记录数量与版本。生产备份、保留周期与多用户隔离尚未实现。

## 开发结构

| 文件 | 作用 |
|---|---|
| public/seed.mjs | 虚构业务与带来源知识 |
| public/engine.mjs | 边界决策、检索与模型引用校验 |
| public/cases.mjs / evaluate.mjs | 冻结用例与逐题比较 |
| public/app.mjs / styles.css | 六区交付界面 |
| public/api.mjs | 本机 HTTP / 公开浏览器数据适配 |
| src/server.mjs / store.mjs | 同源服务、SQLite、发布门禁、工单与导出 |
| src/model.mjs | 无工具结构化 Codex 草稿 |
| scripts/model-smoke.mjs | 两条真实调用，会消耗额度 |

修改业务规则时同时检查测试集的期望，不为凑通过数删除失败。更新题集要增加数据版本并解释原因。每轮执行 npm test、npm run check 和 npm run build:demo；涉及视觉和流程还须实际浏览器验证。
