# 课文写作规范

课程大纲与元数据在 `src/content/curriculum.ts`，正文放在 `src/content/lessons/<stage-id>/<slug>.md`，文件名必须等于大纲里的 `slug`。

## 读者与语气

- 读者：有基本 Linux 命令行经验、但没接触过 Kubernetes 的工程师，按阶段一路学到能运维生产集群。
- 语言：简体中文。专有名词第一次出现时给英文原词，例如"控制平面（Control Plane）"。K8s 资源名保持英文（Pod、Deployment、Service）。
- 先讲"为什么需要它"，再讲"它是什么"，最后"怎么用"和"生产里要注意什么"。
- 每个概念配一个能在 kind 集群里真实运行的例子（阶段 4、5 的生产内容除外，明确说明需要的环境）。
- 不要空话套话，不要"总而言之"式的收尾段。

## 文件结构

```markdown
# 课文标题（与 curriculum.ts 中 title 一致，页面会自动隐藏这一行）

开篇 1～2 段：这一课解决什么问题，学完能做什么。

## 二级标题 …（进入右侧目录）
### 三级标题 …（进入右侧目录）

## 动手练习
1. …（可操作的小任务，3～5 条）

## 自测
<details>
<summary>问题一？</summary>

答案（summary 后面空一行，答案里可以用 Markdown）。

</details>

## 参考资料
- [Kubernetes 官方文档：xxx](https://kubernetes.io/zh-cn/docs/...)
```

## 可用的 Markdown 扩展

- 代码块带文件名：` ```yaml title="nginx-pod.yaml" `。支持高亮的语言：bash/sh/console、yaml、json、dockerfile、go、python、ini/toml、text。
- 提示框（blockquote 第一行写类型，可选自定义标题）：

  ```markdown
  > [!TIP] 可选的标题
  > 内容……
  ```

  类型：`NOTE` 说明、`TIP` 提示、`WARNING` 注意、`DANGER` 危险、`LAB` 动手实验、`PROD` 生产实践。
- 表格用 GFM 语法；架构图用 ` ```text ` 代码块画 ASCII 图。
- 课程之间互相引用用站内链接：`[Pod](/learn/pods)`。

## 内容来源

- Kubernetes 官方文档（优先中文版 https://kubernetes.io/zh-cn/docs/），链接要真实存在。
- 团队实践仓库 `k8s-in-action`（Kubespray、Cilium、Rook-Ceph、VictoriaMetrics、GPU Operator 等）。引用时去掉内部域名、内部 IP 和公司名，改成 `example.com`、`192.168.x.x` 这类通用示例。
- 版本号：YAML 的 apiVersion 使用当前稳定版本；组件版本写"截至本文写作时"的版本并提醒读者以官方发布为准。
