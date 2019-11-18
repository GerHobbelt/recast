import assert from "assert";
import fs from "fs";
import path from "path";
var eol = require("os").EOL;
import * as types from "@gerhobbelt/ast-types";
import * as recast from "../main";

var nodeMajorVersion = parseInt(process.versions.node, 10);

function testFile(path: string, done: function, options: { parser?: any } = {}) {
    fs.readFile(path, "utf-8", function(err, source) {
        source = source.replace(/\r?\n/g, eol);
        assert.equal(err, null);
        assert.strictEqual(typeof source, "string");

        var ast = recast.parse(source, options);
        types.astNodesAreEquivalent.assert(ast.original, ast);
        var code = recast.print(ast).code;
        assert.strictEqual(source, code);
        
        done();
    });
}

function addTest(name: string) {
    it(name, function(done) {
        var filename = path.join(__dirname, "..", name);

        if (path.extname(filename) === ".ts") {
            // Babel 7 no longer supports Node 4 and 5.
            if (nodeMajorVersion >= 6) {
                testFile(filename, done, { parser: require("../parsers/typescript") });
            }
        } else {
            testFile(filename, done);
        }
    });
}

describe("identity", function() {
    // Add more tests here as need be.
    addTest("test/data/regexp-props.js");
    addTest("test/data/empty.js");
    addTest("test/data/backbone.js");
    addTest("test/lines.ts");
    addTest("lib/lines.ts");
    addTest("lib/printer.ts");
});
