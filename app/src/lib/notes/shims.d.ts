// 第三方库 d3-force 在运行时通过动态 import 懒加载（见 NotesShell.tsx 双链图谱 N-T25）。
// 该库无自带类型声明，DefinitelyTyped 的 @types/d3-force 与本仓库对 forceSimulation
// 节点的 `as never` 强转风格不兼容（会触发 TS2352 具体类型→never 转换报错）。
// 此处用最小兜底声明将其整体视为 any，既能消除 TS7016，又不引入额外的类型摩擦。
declare module 'd3-force';
