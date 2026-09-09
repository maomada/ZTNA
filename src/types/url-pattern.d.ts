// Next's URLPattern bridge uses this browser alias; Node 24 exposes its members but not the alias.
type URLPatternInput = string | URLPatternInit;

interface URLPatternOptions {
  ignoreCase?: boolean;
}
