# 论坛通道

论坛通道通过 `--type forum` 创建，创建后不可变。默认阅读路径是论坛摘要、单个 thread（线程）时间线和当前上下文，而不是普通聊天流。

## 创建论坛

```bash
trellis channel create design-feedback \
  --type forum \
  --scope global \
  --description "跨项目设计反馈板。" \
  --context-raw "每个设计主题一个 thread；解决后关闭。" \
  --by main
```

使用 `--scope project` 限定单个仓库，使用 `--scope global` 建立跨项目板。

## 打开、评论和关闭 thread

```bash
trellis channel post design-feedback opened --scope global --as main --thread login-empty-state --title "登录页空状态" --description "记录新的登录空状态设计反馈。" --labels design,login --text-file /tmp/thread-open.md
trellis channel post design-feedback comment --scope global --as reviewer --thread login-empty-state --text-file /tmp/review.md
trellis channel post design-feedback status --scope global --as main --thread login-empty-state --status closed
trellis channel post design-feedback summary --scope global --as main --thread login-empty-state --summary "采用 option-B 布局；TRELLIS-123 负责修复。"
```

`--description` 是持久 thread 描述；`--text` / `--stdin` / `--text-file` 是本次事件正文。`--thread` 使用稳定的小写 kebab-case（短横线命名）键。

## 阅读与上下文

```bash
trellis channel forum design-feedback --scope global
trellis channel thread design-feedback login-empty-state --scope global --raw
trellis channel context list design-feedback --scope global --thread login-empty-state
```

优先使用 CLI 投影，不要先手工解析 `events.jsonl`。论坛适合议题、发布待办、反馈和长期可审计的结论；短暂单轮交流使用 chat（聊天）通道。
