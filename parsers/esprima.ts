"use strict";

// This module is suitable for passing as options.parser when calling
// recast.parse to process ECMAScript code with Esprima:
//
//   const ast = recast.parse(source, {
//     parser: require("recast/parsers/esprima")
//   });
//
import { getOption } from "../lib/util";

// `extraOptions` required by unit tests to pass additional options to esprima
export function parse(source: string, options?: any, extraOptions: any) {
  const comments: any[] = [];
  const ast = require("@gerhobbelt/esprima").parse(source, {
    loc: true,
    locations: true,
    comment: true,
    onComment: comments,
    range: getOption(options, "range", false),
    tolerant: getOption(options, "tolerant", true),
    tokens: true,                      // getOption(options, "tokens", true),
    ...extraOptions
  });

  if (!Array.isArray(ast.comments)) {
    ast.comments = comments;
  }

  return ast;
};
