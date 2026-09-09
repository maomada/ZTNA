// Next 的 URLPattern 桥接使用此浏览器别名；Node 24 暴露其成员，但不暴露该别名。
type URLPatternInput = string | URLPatternInit;

interface URLPatternOptions {
  ignoreCase?: boolean;
}
