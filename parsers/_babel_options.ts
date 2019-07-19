import { ParserOptions, ParserPlugin } from "@babel/parser";
import { getOption } from "../lib/util";

export type Overrides = Partial<{
  sourceType: ParserOptions["sourceType"];
  strictMode: ParserOptions["strictMode"];
}>;

export default function getBabelOptions(options?: Overrides): ParserOptions & { plugins: ParserPlugin[] } {
  // The goal here is to tolerate as much syntax as possible, since Recast
  // is not in the business of forbidding anything. If you want your
  // parser to be more restrictive for some reason, you can always pass
  // your own parser object to recast.parse.
  return {
    sourceType: getOption(options, "sourceType", "module"),
    strictMode: getOption(options, "strictMode", false),
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    startLine: 1,
    tokens: true,                   // getOption(options, "tokens", true),
    ranges: getOption(options, "range", true),
    plugins: [
      // The "*" glob no longer seems to include the following plugins:
      "asyncGenerators",
      "bigInt",
      "classPrivateMethods",
      "classPrivateProperties",
      "classProperties",
      "decorators-legacy",
      "doExpressions",
      "dynamicImport",
      "exportDefaultFrom",
      "exportExtensions" as any as ParserPlugin,
      "exportNamespaceFrom",
      "functionBind",
      "functionSent",
      "importMeta",
      "nullishCoalescingOperator",
      "numericSeparator",
      "objectRestSpread",
      "optionalCatchBinding",
      "optionalChaining",
      ["pipelineOperator", { proposal: "minimal" }] as any as ParserPlugin,
      "throwExpressions",
      // Other experimental plugins that we could enable:
      // https://github.com/babel/babylon#plugins
    ]
  };
};
