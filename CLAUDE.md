# CYBER-CORE // 机器人控制中心 — 全栈控制台

## 技术栈
- Frontend: HTML5 + Tailwind CSS CDN + Chart.js 4.x + Lucide Icons, 纯原生JS
- Backend: Node.js + Express + WebSocket (`ws`) + `systeminformation` + `sql.js` (SQLite WASM)
- 主题: 赛博工业风, 3套主题 (cyber/neon/matrix) CSS变量切换
- 字体: Inter (UI) + JetBrains Mono (代码/数据)

## 架构

```
index.html (2726行) ←→ WebSocket/REST ←→ server.js (:8771)
                                            ├── lib/telemetry.js (systeminformation)
                                            ├── lib/process-manager.js (child_process)
                                            ├── lib/config.js (robots.json)
                                            ├── routes/api.js (REST)
                                            ├── routes/ws.js (WebSocket)
                                            ├── db/database.js (SQLite via sql.js)
                                            └── scripts/sensor.js (模拟节点进程)
```

## 启动

```bash
npm start          # 生产模式
npm run dev        # 开发模式 (--watch)
```

打开 http://localhost:8771

## 功能模块

1. 顶部状态栏 — 系统标题、在线状态、时钟、海龟按钮
2. 左侧仪表板 — Active Unit选择器(3单元)、遥测(↑↓趋势箭头)、Quick Actions、Alert Log
3. 主面板上 — 系统负载折线图 + 任务队列柱状图 (Chart.js, 实时更新)
4. 主面板下 — 能力矩阵雷达图 + STATUS/TURTLE_DATA合并卡片
5. 底部命令控制台 — 交互式终端 (help/status/scan/logs/clear + ROS2仿真)
6. turtlesim引擎 — 仿ROS2 turtlesim, requestAnimationFrame仿真循环
7. TURTLE_DATA面板 — 轨迹画布 + 位姿 + 画笔状态 + 速度图表

## Quick Actions → 真实进程管理

| 按钮 | API | 后端操作 |
|------|-----|---------|
| INIT | POST /api/units/:id/init | child_process.spawn() 逐节点启动 |
| HALT | POST /api/units/:id/halt | SIGTERM优雅停机, 5秒超时 |
| RESET | POST /api/units/:id/reset | SIGKILL全部 → spawn全新 |
| KILL | POST /api/units/:id/kill | confirm→SIGKILL强行终止 |

- 3单元×6节点=18进程 (robots.json配置, 端口9101-9306)
- 进程存活监控 + 异常退出自动告警
- 服务关闭自动清理子进程

## REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/status | 系统快照 (实时CPU/MEM/NET/TEMP) |
| GET | /api/units | 单元列表 |
| GET | /api/units/:id | 单元详情+进程状态 |
| GET | /api/units/:id/alerts | 告警历史 (DB, 最近50条) |
| GET | /api/processes | 所有被管进程状态 |
| POST | /api/units/:id/init | 启动单元所有节点 |
| POST | /api/units/:id/halt | 冻结单元所有节点 |
| POST | /api/units/:id/reset | 重启单元所有节点 |
| POST | /api/units/:id/kill | 紧急停止单元所有节点 |

## WebSocket (ws://localhost:8771/ws)

消息类型: `telemetry`(2秒推送), `alert`(事件即时), `action_result`(操作结果广播)

## 优雅降级

WS断连 → 自动回退Math.random()模拟数据 → WS恢复 → 自动切回真实数据
前端不改任何原有功能, 增量+80行

## 配置

- robots.json — 单元/节点/进程定义, 支持自定义command/args
- scripts/sensor.js — 模拟传感器节点, 可替换为python/ros2/任意

## 文件结构

```
index.html              — 单页前端 (2726行+80)
server.js               — 服务器入口
package.json            — deps: express, ws, systeminformation, sql.js
robots.json             — 机器人节点清单
scripts/sensor.js       — 模拟进程
db/database.js          — SQLite WASM封装
routes/api.js           — REST路由
routes/ws.js            — WebSocket处理
lib/telemetry.js        — systeminformation封装
lib/process-manager.js  — 子进程管理
lib/config.js           — 配置读取
```
