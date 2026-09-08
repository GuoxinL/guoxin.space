#!/bin/bash
# Qwik迁移工具 - 自动化初始化和配置脚本
# 使用pnpm作为包管理器

set -e

echo "🚀 开始Qwik迁移工具初始化..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查pnpm是否已安装
check_pnpm() {
    log_info "检查pnpm安装状态..."
    if command -v pnpm &> /dev/null; then
        log_success "pnpm已安装: $(pnpm --version)"
    else
        log_error "pnpm未安装，请先安装pnpm"
        echo "安装命令:"
        echo "  npm install -g pnpm"
        echo "  或者"
        echo "  yarn global add pnpm"
        echo "  或者"
        echo "  curl -fsSL https://get.pnpm.io/install.sh | sh -"
        exit 1
    fi
}

# 创建Qwik项目
create_qwik_project() {
    log_info "创建Qwik项目..."
    
    # 创建项目目录
    mkdir -p qwik-personal-homepage
    cd qwik-personal-homepage
    
    # 初始化Qwik项目
    log_info "使用pnpm创建Qwik项目..."
    pnpm create qwik@latest . -- --install --install-deps
    
    log_success "Qwik项目创建完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    pnpm install
    
    log_info "安装Qwik相关插件..."
    pnpm add -D @builder.io/qwik-city @builder.io/qwik-labs
    
    log_success "所有依赖安装完成"
}

# 配置package.json
configure_package_json() {
    log_info "配置package.json..."
    
    # 备份原package.json
    cp package.json package.json.backup
    
    # 更新package.json内容
    cat > package.json << 'EOF'
{
  "name": "qwik-personal-homepage",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "qwik build",
    "build.client": "vite build --config vite.config.ts",
    "build.preview": "vite build --config vite.config.ts --ssr src/entry.preview.tsx",
    "dev": "vite dev --open",
    "dev.debug": "vite dev --force --mode debug",
    "preview": "vite preview --base=/",
    "serve": "npm run build && npm run preview",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint \"src/**/*.ts*\" \"*.json\" \"*.md\" --max-warnings 0",
    "lint:fix": "eslint \"src/**/*.ts*\" \"*.json\" \"*.md\" --fix",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "@builder.io/qwik": "1.8.2",
    "@builder.io/qwik-city": "1.8.2",
    "@builder.io/qwik-labs": "1.8.2",
    "@types/eslint": "8.56.10",
    "@types/node": "20.14.12",
    "@typescript-eslint/eslint-plugin": "7.17.0",
    "@typescript-eslint/parser": "7.17.0",
    "eslint": "8.57.0",
    "eslint-plugin-qwik": "1.8.2",
    "prettier": "3.3.3",
    "typescript": "5.5.4",
    "vite": "5.3.7",
    "vite-tsconfig-paths": "4.3.2"
  },
  "dependencies": {
    "qwik-city": "1.8.2"
  }
}
EOF
    
    log_success "package.json配置完成"
}

# 创建Qwik配置文件
create_qwik_config() {
    log_info "创建Qwik配置文件..."
    
    # 创建qwik.config.ts
    cat > qwik.config.ts << 'EOF'
import { extendConfig } from '@builder.io/qwik-city/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(() => {
  return {
    plugins: [
      tsconfigPaths(),
      nodePolyfills({
        // Whether to polyfill `global`.
        globals: {
          Buffer: true, // can also be 'build' or 'dev'
          global: true,
          process: true,
        },
        // Whether to polyfill specific globals.
        protocolImports: true,
      }),
      extendConfig({
        // Qwik City Vite plugin (already included)
      }),
    ],
  };
});
EOF
    
    # 创建tsconfig.json
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "declaration": true,
    "sourceMap": true,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "~/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/layouts/*": ["src/layouts/*"],
      "@/styles/*": ["src/styles/*"],
      "@/utils/*": ["src/utils/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF
    
    # 创建tsconfig.node.json
    cat > tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
EOF
    
    log_success "Qwik配置文件创建完成"
}

# 创建目录结构
create_directory_structure() {
    log_info "创建项目目录结构..."
    
    # 创建主目录
    mkdir -p src/components
    mkdir -p src/layouts
    mkdir -p src/routes
    mkdir -p src/styles
    mkdir -p src/utils
    mkdir -p src/types
    
    # 创建静态资源目录
    mkdir -p public/assets
    mkdir -p public/images
    
    log_success "目录结构创建完成"
}

# 创建核心组件
create_core_components() {
    log_info "创建核心组件..."
    
    # 创建Layout组件
    mkdir -p src/layouts
    cat > src/layouts/root-layout.tsx << 'EOF'
import { component$, Slot } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { RequestHandler } from '@builder.io/qwik-city';
import { Header } from '../components/header';
import { Footer } from '../components/footer';

export const onGet: RequestHandler = ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    maxAge: 60 * 60 * 24,
  });
};

export default component$(() => {
  return (
    <html lang="zh-CN" class="h-full">
      <head>
        <meta charset="utf-8" />
        <link rel="icon" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>个人主页 - Guoxin</title>
        <meta name="description" content="Guoxin的个人主页 - AI友好的现代Web应用" />
      </head>
      <body class="h-full">
        <Header />
        <main class="flex-1">
          <Slot />
        </main>
        <Footer />
      </body>
    </html>
  );
});
EOF
    
    # 创建Header组件
    cat > src/components/header.tsx << 'EOF'
import { component$, $, useSignal } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';

export const Header = component$(() => {
  const isMenuOpen = useSignal(false);

  const toggleMenu = $(() => {
    isMenuOpen.value = !isMenuOpen.value;
  });

  return (
    <header class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" class="flex items-center">
            <span class="text-xl font-bold text-gray-900">Guoxin</span>
          </Link>

          {/* Desktop Navigation */}
          <nav class="hidden md:flex space-x-8">
            <Link href="/" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
              首页
            </Link>
            <Link href="/skills" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
              技能
            </Link>
            <Link href="/json" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
              JSON工具
            </Link>
            <Link href="/running" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
              运动数据
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick$={toggleMenu}
            class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <span class="sr-only">打开菜单</span>
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMenuOpen.value ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen.value && (
          <div class="md:hidden">
            <nav class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link href="/" class="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium">
                首页
              </Link>
              <Link href="/skills" class="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium">
                技能
              </Link>
              <Link href="/json" class="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium">
                JSON工具
              </Link>
              <Link href="/running" class="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium">
                运动数据
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
});
EOF
    
    # 创建Footer组件
    cat > src/components/footer.tsx << 'EOF'
import { component$ } from '@builder.io/qwik';

export const Footer = component$(() => {
  return (
    <footer class="bg-gray-50 border-t border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-center text-gray-600">
          <p>&copy; 2024 Guoxin. AI友好的现代Web应用.</p>
          <p class="mt-2 text-sm">Powered by Qwik & GitHub Pages</p>
        </div>
      </div>
    </footer>
  );
});
EOF
    
    log_success "核心组件创建完成"
}

# 创建路由组件
create_route_components() {
    log_info "创建路由组件..."
    
    # 创建首页组件
    mkdir -p src/routes
    cat > src/routes/index.tsx << 'EOF'
import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section class="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 class="text-4xl md:text-6xl font-bold mb-6">
            欢迎来到 Guoxin 的空间
          </h1>
          <p class="text-xl md:text-2xl mb-8 text-blue-100">
            AI友好 · 现代Web · 开放生态
          </p>
          <Link 
            href="/skills" 
            class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition duration-200"
          >
            探索技能
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section class="py-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 class="text-3xl font-bold text-center text-gray-900 mb-12">
            核心特性
          </h2>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="bg-white p-6 rounded-lg shadow-md">
              <div class="text-blue-600 mb-4">
                <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-gray-900 mb-2">零运行时</h3>
              <p class="text-gray-600">Qwik采用创新的零运行时设计，实现极致性能和快速加载</p>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
              <div class="text-green-600 mb-4">
                <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-gray-900 mb-2">智能分割</h3>
              <p class="text-gray-600">自动代码分割和懒加载，实现按需加载和最佳性能</p>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
              <div class="text-purple-600 mb-4">
                <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-gray-900 mb-2">AI友好</h3>
              <p class="text-gray-600">语义化HTML结构，AI友好设计，支持更好的内容理解</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Guoxin的个人主页",
  meta: [
    {
      name: "description",
      content: "Guoxin的个人主页 - AI友好的现代Web应用，展示个人技能和项目",
    },
  ],
};
EOF
    
    # 创建技能页面路由
    mkdir -p src/routes/skills
    cat > src/routes/skills/index.tsx << 'EOF'
import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="min-h-screen bg-gray-50">
      <section class="py-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 class="text-4xl font-bold text-center text-gray-900 mb-12">
            技能展示
          </h1>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Skills will be populated here */}
            <div class="bg-white p-6 rounded-lg shadow-md">
              <h3 class="text-xl font-semibold text-gray-900 mb-4">技能正在迁移</h3>
              <p class="text-gray-600">Qwik版本正在开发中...</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "技能展示 - Guoxin",
  meta: [
    {
      name: "description",
      content: "Guoxin的技能展示 - AI友好的技能管理系统",
    },
  ],
};
EOF
    
    log_success "路由组件创建完成"
}

# 创建样式文件
create_styles() {
    log_info "创建样式文件..."
    
    # 创建全局样式
    mkdir -p src/styles
    cat > src/styles/global.css << 'EOF'
/* Qwik全局样式 */
:root {
  --primary-color: #3b82f6;
  --primary-hover: #2563eb;
  --secondary-color: #8b5cf6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --border-color: #e5e7eb;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: var(--text-primary);
  background-color: var(--bg-secondary);
}

h1, h2, h3, h4, h5, h6 {
  margin-bottom: 0.5rem;
  font-weight: 600;
  line-height: 1.2;
}

h1 { font-size: 2.5rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.5rem; }
h4 { font-size: 1.25rem; }
h5 { font-size: 1.125rem; }
h6 { font-size: 1rem; }

p {
  margin-bottom: 1rem;
}

a {
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.2s;
}

a:hover {
  color: var(--primary-hover);
}

button {
  font-family: inherit;
  font-size: 100%;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem 1rem;
  transition: all 0.2s;
}

input, textarea, select {
  font-family: inherit;
  font-size: 100%;
  line-height: 1.5;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  transition: border-color 0.2s;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-4 { margin-top: 1rem; }
.mt-8 { margin-top: 2rem; }
.mt-12 { margin-top: 3rem; }

.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-8 { margin-bottom: 2rem; }
.mb-12 { margin-bottom: 3rem; }

.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.p-8 { padding: 2rem; }

.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow-md { box-shadow: var(--shadow-md); }
.shadow-lg { box-shadow: var(--shadow-lg); }

.rounded-lg { border-radius: 0.5rem; }
.rounded-md { border-radius: 0.375rem; }

.hidden { display: none; }
.block { display: block; }
.inline { display: inline; }
.inline-block { display: inline-block; }

/* 响应式工具类 */
@media (max-width: 768px) {
  .md\\:hidden { display: none; }
  .md\\:block { display: block; }
}

@media (min-width: 769px) {
  .md\\:hidden { display: none; }
  .md\\:block { display: block; }
}
EOF
    
    log_success "样式文件创建完成"
}

# 创建GitHub Actions工作流
create_github_actions() {
    log_info "创建GitHub Actions工作流..."
    
    mkdir -p .github/workflows
    cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths-ignore:
      - '**'
      - '!/**.md'
      - '!.github'
  pull_request:
    branches: [main]
    paths-ignore:
      - '**'
      - '!/**.md'
      - '!.github'

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
          run_install: true

      - name: Install dependencies
        run: pnpm install

      - name: Build Qwik application
        run: pnpm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
EOF
    
    log_success "GitHub Actions工作流创建完成"
}

# 创建示例数据文件
create_example_data() {
    log_info "创建示例数据文件..."
    
    # 创建示例技能数据
    mkdir -p src/data
    cat > src/data/skills.ts << 'EOF'
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  level: number;
  tags: string[];
  repository?: string;
  documentation?: string;
  featured: boolean;
}

export const skills: Skill[] = [
  {
    id: "qwik-framework",
    name: "Qwik框架",
    description: "零运行时Web框架，实现极致性能",
    category: "前端框架",
    level: 5,
    tags: ["TypeScript", "React", "性能优化"],
    repository: "https://github.com/BuilderIO/qwik",
    documentation: "https://qwik.builder.io/docs/",
    featured: true,
  },
  {
    id: "ai-llm-integration",
    name: "AI大模型集成",
    description: "现代AI应用的集成和部署方案",
    category: "人工智能",
    level: 4,
    tags: ["OpenAI", "Claude", "LangChain"],
    featured: true,
  },
];
EOF
    
    log_success "示例数据文件创建完成"
}

# 生成README文件
create_readme() {
    log_info "生成README文件..."
    
    cat > README.md << 'EOF'
# Qwik个人主页

基于Qwik框架的现代化个人主页，支持GitHub Pages部署，AI友好的Web应用。

## 🚀 特性

- ✨ **零运行时**: Qwik创新的零运行时设计
- 🚀 **极致性能**: 自动代码分割和懒加载
- 📱 **响应式设计**: 完美的移动端体验
- 🤖 **AI友好**: 语义化HTML结构
- 🎨 **现代UI**: 基于Tailwind CSS的现代设计
- 🔧 **TypeScript**: 完整的类型支持
- 📦 **PNPM**: 高效的包管理
- 🚀 **GitHub Pages**: 一键部署

## 🛠️ 技术栈

- **框架**: Qwik 1.8.2
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **包管理**: PNPM
- **构建工具**: Vite
- **部署**: GitHub Pages

## 📦 安装和运行

### 环境要求

- Node.js 20+
- PNPM

### 安装依赖

\`\`\`bash
pnpm install
\`\`\`

### 开发模式

\`\`\`bash
pnpm dev
\`\`\`

### 构建生产版本

\`\`\`bash
pnpm build
\`\`\`

### 预览生产版本

\`\`\`bash
pnpm preview
\`\`\`

## 🚀 部署

### GitHub Pages部署

项目已配置GitHub Actions，推送到main分支即可自动部署：

\`\`\`bash
git add .
git commit -m "feat: add new features"
git push origin main
\`\`\`

### 本地预览

部署后的项目可以通过以下地址访问：

\`\`\`bash
# 构建后预览
pnpm preview
\`\`\`

## 📁 项目结构

\`\`\`
src/
├── components/         # 可复用组件
├── layouts/           # 布局组件
├── routes/           # 路由组件
├── styles/           # 样式文件
├── utils/            # 工具函数
└── types/            # TypeScript类型定义

public/              # 静态资源
├── assets/          # 图片和媒体资源
└── images/         # 示例图片

.github/workflows/   # GitHub Actions工作流
\`\`\`

## 🎨 样式系统

项目使用Tailwind CSS构建响应式界面：

- 语义化颜色变量
- 响应式工具类
- 组件化样式

## 🔧 开发指南

### 添加新页面

1. 在 \`src/routes/\` 目录下创建新的路由组件
2. 导出 \`DocumentHead\` 配置元数据
3. 配置相应的菜单项

### 添加新组件

1. 在 \`src/components/\` 目录下创建新组件
2. 使用Qwik的\`component$\`函数定义组件
3. 导出组件供其他组件使用

### 添加样式

1. 在 \`src/styles/\` 目录下添加新的CSS文件
2. 在全局样式中引入新样式
3. 使用CSS变量保持设计一致性

## 📝 贡献指南

1. Fork本项目
2. 创建功能分支 (\`git checkout -b feature/amazing-feature\`)
3. 提交更改 (\`git commit -m 'feat: add amazing feature'\`)
4. 推送到分支 (\`git push origin feature/amazing-feature\`)
5. 创建Pull Request

## 📄 许可证

本项目基于MIT许可证开源。

## 🔗 相关链接

- [Qwik官方文档](https://qwik.builder.io/docs/)
- [GitHub Pages](https://pages.github.com/)
- [PNPM](https://pnpm.io/)
- [Tailwind CSS](https://tailwindcss.com/)
EOF
    
    log_success "README文件创建完成"
}

# 主函数
main() {
    echo "🚀 Qwik迁移工具开始执行..."
    
    # 执行各步骤
    check_pnpm
    create_directory_structure
    configure_package_json
    create_qwik_config
    create_core_components
    create_route_components
    create_styles
    create_example_data
    create_github_actions
    create_readme
    
    log_success "🎉 Qwik迁移工具执行完成!"
    
    echo ""
    echo "📋 下一步操作:"
    echo "  1. cd qwik-personal-homepage"
    echo "  2. pnpm install"
    echo "  3. pnpm dev"
    echo "  4. 访问 http://localhost:5173"
    echo ""
    echo "📁 项目结构已创建完成，包含完整的Qwik项目"
    echo "🚀 GitHub Actions已配置，推送到main分支即可自动部署"
}

# 执行主函数
main "$@"