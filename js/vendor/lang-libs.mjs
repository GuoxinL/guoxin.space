/* 第三方语言解析库桥接层（vendored 本地，零网络依赖）
   把 ESM 库挂到 window.LIBS，供普通脚本 json.js 使用。
   加载完成后设置 window.LIBS_ready = true 并派发 libsready 事件。 */
import * as jtoml from "./j-toml.mjs";
import * as fxp from "./fast-xml-parser.mjs";
import * as jpath from "./jsonpath-plus.mjs";

window.LIBS = {
  yaml: window.jsyaml,            // 由 js-yaml.min.js (UMD) 注入全局
  tomlParse: jtoml.parse,
  tomlStringify: jtoml.stringify,
  XMLParser: fxp.XMLParser,
  XMLBuilder: fxp.XMLBuilder,
  JSONPath: jpath.JSONPath
};
window.LIBS_ready = true;
document.dispatchEvent(new CustomEvent("libsready"));
