> ⚠️ **归档文档**：本文件为历史 / 已落地过程稿。本仓库现行规范以 `.harness/docs/`（架构·部署·开发准则）与根 `DESIGN.md`、`AGENTS.md` 为准；重构相关以同目录 `QWIK-REFACTORING-PLAN.md` / `REFACTOR-SUMMARY.md` 为历史权威。

# 单词本功能设计文档

## 1. 功能概述

单词本是一个基于记忆曲线算法的智能单词学习系统，用户可以：
- 添加单词卡片，包含单词、翻译、发音、例句等信息
- 系统自动根据记忆曲线算法安排复习计划
- 每日打开页面时自动显示需要复习的单词
- 支持第三方API自动获取翻译、发音和例句

## 2. 技术架构

### 2.1 整体架构
```
前端 (个人主页) → Cloudflare Workers (API服务) → GitHub 仓库 (数据存储)
```

### 2.2 核心组件
- **前端模块**: 单词本UI界面，包括添加单词、复习、统计等功能
- **Cloudflare Workers**: 提供API服务，处理数据存储和业务逻辑
- **GitHub仓库**: 存储单词数据，通过Workflow自动同步

## 3. 数据结构

### 3.1 单词卡片数据结构
```json
{
  "id": "unique-id",
  "word": "hello",
  "translation": "你好",
  "pronunciation": "həˈloʊ",
  "example": "Hello, how are you?",
  "difficulty": 1,
  "reviewCount": 0,
  "nextReview": "2023-09-05T08:00:00Z",
  "created": "2023-09-01T10:00:00Z",
  "updated": "2023-09-01T10:00:00Z",
  "tags": ["基础", "日常"]
}
```

### 3.2 复习计划数据结构
```json
{
  "userId": "current-user-id",
  "dailyWords": [
    {
      "wordId": "word-1",
      "word": "hello",
      "translation": "你好"
    },
    {
      "wordId": "word-2", 
      "word": "world",
      "translation": "世界"
    }
  ],
  "reviewDate": "2023-09-04"
}
```

## 4. API设计

### 4.1 前端到Workers的API

#### 4.1.1 添加单词
```
POST /api/wordbook/add
Content-Type: application/json

{
  "word": "hello",
  "translation": "你好",
  "example": "Hello, world!"
}
```

**响应**:
```json
{
  "success": true,
  "word": {
    "id": "word-123",
    "word": "hello",
    "translation": "你好",
    "pronunciation": "həˈloʊ",
    "example": "Hello, world!"
  }
}
```

#### 4.1.2 获取今日复习单词
```
GET /api/wordbook/today
```

**响应**:
```json
{
  "success": true,
  "words": [
    {
      "id": "word-123",
      "word": "hello", 
      "translation": "你好",
      "example": "Hello, world!"
    }
  ]
}
```

#### 4.1.3 标记单词为已复习
```
POST /api/wordbook/review
Content-Type: application/json

{
  "wordId": "word-123",
  "result": "correct" // "correct" 或 "incorrect"
}
```

**响应**:
```json
{
  "success": true,
  "nextReview": "2023-09-06T08:00:00Z"
}
```

### 4.2 Workers到第三方API

#### 4.2.1 获取翻译
```
GET https://api.example.com/translate?q=hello&lang=zh
```

**响应**:
```json
{
  "translation": "你好"
}
```

#### 4.2.2 获取发音
```
GET https://api.example.com/pronunciation?q=hello
```

**响应**:
```json
{
  "pronunciation": "həˈloʊ"
}
```

#### 4.2.3 获取例句
```
GET https://api.example.com/example?q=hello
```

**响应**:
```json
{
  "example": "Hello, how are you?"
}
```

## 5. 记忆曲线算法

### 5.1 算法原理
基于间隔重复算法(Spaced Repetition)，根据用户复习结果调整下次复习时间：

- 正确复习: 下次复习时间 = 当前时间 + 基础间隔 × 难度系数
- 错误复习: 下次复习时间 = 当前时间 + 基础间隔 × 难度系数 / 2

### 5.2 难度系数表
| 复习次数 | 难度系数 |
|---------|---------|
| 1       | 1.0     |
| 2       | 2.0     |
| 3       | 4.0     |
| 4+      | 8.0     |

### 5.3 基础间隔
- 新单词: 1天
- 简单单词: 3天
- 中等单词: 7天  
- 困难单词: 14天

## 6. 前端实现

### 6.1 页面结构
```html
<div class="page" id="page-wordbook">
  <div class="wordbook-container">
    <!-- 添加单词表单 -->
    <div class="add-word-form">
      <input type="text" id="new-word" placeholder="输入新单词...">
      <button onclick="addWord()">添加</button>
    </div>
    
    <!-- 今日复习 -->
    <div class="today-review">
      <h2>今日复习 ({reviewCount}个单词)</h2>
      <div class="word-card" v-for="word in todayWords">
        <div class="word">{word.word}</div>
        <div class="translation">{word.translation}</div>
        <div class="example">{word.example}</div>
        <div class="actions">
          <button onclick="markCorrect(word.id)">记得</button>
          <button onclick="markIncorrect(word.id)">忘记</button>
        </div>
      </div>
    </div>
    
    <!-- 单词列表 -->
    <div class="word-list">
      <h2>所有单词 ({totalWords}个)</h2>
      <div class="word-card" v-for="word in allWords">
        <div class="word">{word.word}</div>
        <div class="translation">{word.translation}</div>
        <div class="next-review">下次复习: {formatDate(word.nextReview)}</div>
      </div>
    </div>
  </div>
</div>
```

### 6.2 JavaScript实现
```javascript
// 单词本模块
var Wordbook = {
  init: function() {
    this.loadTodayWords();
    this.loadAllWords();
  },
  
  addWord: function(word) {
    fetch('/api/wordbook/add', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({word: word})
    }).then(response => response.json())
      .then(data => {
        if (data.success) {
          this.loadTodayWords();
          this.loadAllWords();
        }
      });
  },
  
  loadTodayWords: function() {
    fetch('/api/wordbook/today')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.todayWords = data.words;
          this.renderTodayWords();
        }
      });
  },
  
  loadAllWords: function() {
    fetch('/api/wordbook/all')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.allWords = data.words;
          this.renderAllWords();
        }
      });
  },
  
  markCorrect: function(wordId) {
    fetch('/api/wordbook/review', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({wordId: wordId, result: 'correct'})
    }).then(response => response.json())
      .then(data => {
        if (data.success) {
          this.loadTodayWords();
        }
      });
  },
  
  markIncorrect: function(wordId) {
    fetch('/api/wordbook/review', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({wordId: wordId, result: 'incorrect'})
    }).then(response => response.json())
      .then(data => {
        if (data.success) {
          this.loadTodayWords();
        }
      });
  }
};
```

## 7. Cloudflare Workers实现

### 7.1 Workers代码结构
```javascript
// wordbook-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  
  if (path.startsWith('/api/wordbook/')) {
    return handleWordbookRequest(request, path)
  }
  
  return new Response('Not found', {status: 404})
}

async function handleWordbookRequest(request, path) {
  const method = request.method
  
  switch(path) {
    case '/api/wordbook/add':
      return handleAddWord(request)
    case '/api/wordbook/today':
      return handleGetTodayWords(request)
    case '/api/wordbook/review':
      return handleReviewWord(request)
    default:
      return new Response('Not found', {status: 404})
  }
}

async function handleAddWord(request) {
  const data = await request.json()
  const word = data.word
  
  // 调用第三方API获取翻译、发音、例句
  const translation = await getTranslation(word)
  const pronunciation = await getPronunciation(word)
  const example = await getExample(word)
  
  // 保存到GitHub仓库
  const wordData = {
    id: generateId(),
    word: word,
    translation: translation,
    pronunciation: pronunciation,
    example: example,
    difficulty: 1,
    reviewCount: 0,
    nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  }
  
  await saveToGitHub(wordData)
  
  return new Response(JSON.stringify({success: true, word: wordData}), {
    headers: {'Content-Type': 'application/json'}
  })
}

async function handleGetTodayWords(request) {
  // 从GitHub获取今日需要复习的单词
  const todayWords = await getTodayWordsFromGitHub()
  
  return new Response(JSON.stringify({success: true, words: todayWords}), {
    headers: {'Content-Type': 'application/json'}
  })
}

async function handleReviewWord(request) {
  const data = await request.json()
  const wordId = data.wordId
  const result = data.result
  
  // 更新单词的复习状态
  await updateWordReviewStatus(wordId, result)
  
  return new Response(JSON.stringify({success: true}), {
    headers: {'Content-Type': 'application/json'}
  })
}
```

### 7.2 GitHub数据存储
使用GitHub API存储单词数据，通过Workflow自动同步：

```yaml
# .github/workflows/wordbook-sync.yml
name: Wordbook Sync
on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * *' # 每天午夜运行

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2
        
      - name: Get words data
        run: |
          # 从Cloudflare Workers获取最新数据
          curl -X GET https://wordbook-worker.example.com/api/wordbook/all > words.json
      
      - name: Commit and push
        run: |
          git config --global user.name "Wordbook Bot"
          git config --global user.email "bot@wordbook.com"
          git add words.json
          git commit -m "Update wordbook data"
          git push
```

## 8. 第三方API集成

### 8.1 翻译API
- **服务**: Google Translate API (免费版)
- ** endpoint**: `https://translate.googleapis.com/translate_a/single`
- **参数**: `q=hello&lang=zh&client=gtx`

### 8.2 发音API
- **服务**: Google Text-to-Speech API
- **endpoint**: `https://translate.googleapis.com/translate_tts`
- **参数**: `q=hello&lang=en&client=gtx`

### 8.3 例句API
- **服务**: Oxford Dictionaries API (免费版)
- **endpoint**: `https://od-api.oxforddictionaries.com/api/v2/entries/en/hello`
- **参数**: `fields=examples`

## 9. 安全考虑

### 9.1 API密钥管理
- 使用Cloudflare Workers环境变量存储API密钥
- 避免在前端暴露敏感信息

### 9.2 数据验证
- 对用户输入进行验证和清理
- 防止XSS攻击

### 9.3 速率限制
- 实现API请求速率限制
- 防止滥用

## 10. 性能优化

### 10.1 缓存策略
- 对第三方API响应进行缓存
- 使用CDN加速静态资源

### 10.2 数据分页
- 对大量单词数据进行分页加载
- 实现懒加载

## 11. 扩展功能

### 11.1 多语言支持
- 支持多种语言的单词学习
- 自定义语言对

### 11.2 统计分析
- 显示学习进度和统计数据
- 生成学习报告

### 11.3 社交功能
- 分享学习进度
- 与其他用户竞争

## 12. 部署计划

### 12.1 前端部署
- 添加单词本模块到个人主页
- 更新导航和路由

### 12.2 Workers部署
- 部署Cloudflare Workers
- 配置环境变量

### 12.3 GitHub配置
- 设置Workflow自动同步
- 配置权限和密钥

## 13. 测试计划

### 13.1 单元测试
- 测试记忆曲线算法
- 测试API接口

### 13.2 集成测试
- 测试前后端集成
- 测试第三方API集成

### 13.3 用户测试
- 邀请用户进行功能测试
- 收集反馈和改进建议

## 14. 维护计划

### 14.1 监控
- 监控API使用情况和错误率
- 监控数据同步状态

### 14.2 更新
- 定期更新第三方API
- 优化算法和性能

### 14.3 备份
- 定期备份单词数据
- 确保数据安全

---

**设计完成**: 此文档包含了单词本功能的完整设计方案，包括技术架构、数据结构、API设计、算法实现和部署计划。下一步可以根据此文档开始具体实现。