const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // 必须用绝对路径：经 PostCSS 插件调用时，Tailwind 的 content 基目录是 pnpm 的工作目录
  // （仓库根），而非本配置文件所在目录（app/），相对路径会扫到不存在的 src/ 而产出 0 个工具类。
  content: [path.resolve(__dirname, 'src/**/*.{ts,tsx,html}')],
  theme: {
    extend: {},
  },
  plugins: [],
};
