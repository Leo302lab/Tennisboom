# BoomTennis

轻量化网球训练手机 Web 应用。

当前阶段只建立工程目录。推荐开发顺序：姿态关键点 → 挥拍事件 → 高光截取 → 评分规则 → 手机端 UI。

## 目录

```text
BoomTennis/
├─ docs/                    产品、算法与测试文档
├─ public/                  静态资源与浏览器端模型
├─ scripts/                 独立调试和数据处理脚本
├─ src/
│  ├─ app/                  应用入口、路由和全局配置
│  ├─ pages/                手机端页面
│  ├─ components/           通用及业务 UI 组件
│  ├─ features/             核心业务能力
│  │  ├─ camera/            摄像头和循环录像
│  │  ├─ pose/              姿态模型适配与关键点
│  │  ├─ stroke-detection/  挥拍阶段与事件识别
│  │  ├─ highlights/        高光片段生成
│  │  ├─ scoring/           评分与建议规则
│  │  └─ sessions/          训练记录
│  ├─ hooks/                React Hooks
│  ├─ services/             存储、接口和模型服务
│  ├─ state/                全局状态
│  ├─ styles/               主题与全局样式
│  ├─ types/                公共类型
│  ├─ utils/                无业务依赖工具
│  └─ workers/              浏览器后台计算
└─ tests/                   单元、集成和端到端测试
```

# Tennisboom
ai analysis
