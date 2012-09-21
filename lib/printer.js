var assert = require("assert"),
    Syntax = require("./syntax"),
    printComment = require("./comments").print,
    linesModule = require("./lines"),
    fromString = linesModule.fromString,
    concat = linesModule.concat,
    Parser = require("./parser").Parser;

function Printer(parser) {
    assert.ok(this instanceof Printer);
    assert.ok(parser instanceof Parser);

    function printWithComments(node) {
        if (!node)
            return fromString("");

        var without = print(node),
            orig = node.original;

        if (orig && orig.comments) {
            var printed = orig.comments.map(printComment);
            if (without)
                printed.push(without);
            return fromString("\n").join(printed);
        }

        return without;
    }

    function print(node, includeComments) {
        if (!node)
            return fromString("");

        if (includeComments)
            return printWithComments(node);

        var reprinter = parser.getReprinter(node);
        if (reprinter)
            return reprinter(print);

        return genericPrint(node, printWithComments);
    }

    this.print = print;
    this.printGenerically = printGenerically;
}

exports.Printer = Printer;

function printGenerically(node) {
    return genericPrint(node, printGenerically);
}

function genericPrint(n, print) {
    if (!n)
        return fromString("");

    if (typeof n === "string")
        return fromString(n);

    assert.ok(n instanceof Object);

    switch (n.type) {
    case Syntax.File:
        n = n.program;
        assert.strictEqual(n.type, Syntax.Program);

        // intentionally fall through...

    case Syntax.Program:
        return maybeAddSemicolon(
            fromString("\n\n").join(n.body.map(print)));

    case Syntax.EmptyStatement:
        return fromString("");

    case Syntax.ExpressionStatement:
        return print(n.expression);

    case Syntax.BinaryExpression:
    case Syntax.LogicalExpression:
    case Syntax.AssignmentExpression:
        return fromString(" ").join([
            print(n.left),
            print(n.operator),
            print(n.right)
        ]);

    case Syntax.MemberExpression:
        var parts = [print(n.object)];

        if (n.computed)
            parts.push("[", print(n.property), "]");
        else
            parts.push(".", print(n.property));

        return concat(parts);

    case Syntax.Identifier:
        return fromString(n.name);

    case Syntax.FunctionDeclaration:
    case Syntax.FunctionExpression:
        var parts = ["function"];

        if (n.id)
            parts.push(" ", print(n.id));

        parts.push(
            "(",
            fromString(", ").join(n.params.map(print)),
            ") ",
            print(n.body));

        return concat(parts);

    case Syntax.BlockStatement:
        var naked = printNakedBlockStatement(n, print);
        if (naked.isEmpty())
            return fromString("{}");

        return concat([
            "{\n",
            naked.indent(4),
            "\n}"
        ]);

    case Syntax.ReturnStatement:
        var parts = ["return"];

        if (n.argument)
            parts.push(" ", print(n.argument));

        return concat(parts);

    case Syntax.CallExpression:
        return concat([
            print(n.callee),
            "(",
            fromString(", ").join(n.arguments.map(print)),
            ")"
        ]);

    case Syntax.ObjectExpression:
        var allowBreak = false,
            len = n.properties.length,
            parts = [len > 0 ? "{\n" : "{"];

        n.properties.map(function(prop, i) {
            // Esprima uses this non-standard AST node type.
            prop.type = Syntax.Property;
            prop = print(prop).indent(4);

            var multiLine = prop.length > 1;
            if (multiLine && allowBreak) {
                // Similar to the logic in Syntax.BlockStatement.
                parts.push("\n");
            }

            parts.push(prop);

            if (i < len - 1) {
                // Add an extra line break if the previous object property
                // had a multi-line value.
                parts.push(multiLine ? ",\n\n" : ",\n");
                allowBreak = !multiLine;
            }
        });

        parts.push(len > 0 ? "\n}" : "}");

        return concat(parts);

    case Syntax.Property: // Non-standard AST node type.
        var key = print(n.key),
            val = print(n.value);

        if (!n.kind || n.kind === "init")
            return fromString(": ").join([key, val]);

        assert.strictEqual(val.type, Syntax.FunctionExpression);
        assert.ok(val.id);
        assert.ok(n.kind === "get" ||
                  n.kind === "set");

        return concat([
            n.kind,
            " ",
            print(val.id),
            "(",
            fromString(", ").join(val.params.map(print)),
            ")",
            print(val.body)
        ]);

    case Syntax.ArrayExpression:
        var elems = n.elements,
            len = elems.length,
            parts = ["["];

        elems.forEach(function(elem, i) {
            if (!elem) {
                // If the array expression ends with a hole, that hole
                // will be ignored by the interpreter, but if it ends with
                // two (or more) holes, we need to write out two (or more)
                // commas so that the resulting code is interpreted with
                // both (all) of the holes.
                parts.push(",");
            } else {
                parts.push(print(elem));
                if (i < len - 1)
                    parts.push(",");
            }
        });

        parts.push("]");

        return concat(parts);

    case Syntax.SequenceExpression:
        return concat([
            "(",
            fromString(", ").join(n.expressions.map(print)),
            ")"
        ]);

    case Syntax.ThisExpression:
        return fromString("this");

    case Syntax.Literal:
        if (typeof n.value === "string")
            return fromString(nodeStr(n));
        return fromString(n.value);

    case Syntax.UnaryExpression:
        var parts = [print(n.operator)];
        if (/[a-z]$/.test(n.operator))
            parts.push(" ");
        parts.push(print(n.argument));
        return concat(parts);

    case Syntax.UpdateExpression:
        var parts = [
            print(n.argument),
            print(n.operator)
        ];

        if (n.prefix)
            parts.reverse();

        return concat(parts);

    case Syntax.ConditionalExpression:
        return concat([
            "(", print(n.test),
            " ? ", print(n.consequent),
            " : ", print(n.alternate), ")"
        ]);

    case Syntax.NewExpression:
        // Parenthesize the callee expression in case it's a function call.
        var parts = ["new (", print(n.callee), ")"],
            args = n.arguments;
        if (args)
            parts.push(
                "(",
                fromString(", ").join(args.map(print)),
                ")");

        return concat(parts);

    case Syntax.VariableDeclaration:
        var parts = [n.kind];

        n.declarations.forEach(function(decl, i) {
            if (i === 0)
                parts.push(" ", print(decl));
            else
                parts.push(",\n", print(decl).indent(4));
        });

        return concat(parts);

    case Syntax.VariableDeclarator:
        return n.init ? fromString(" = ").join([
            print(n.id),
            print(n.init)
        ]) : print(n.id);

    case Syntax.WithStatement:
        return concat([
            "with (",
            print(n.object),
            ") ",
            print(n.body)
        ]);

    case Syntax.IfStatement:
        var con = adjustClause(print(n.consequent)),
            parts = ["if (", print(n.test), ")", con];

        if (n.alternate)
            parts.push(
                endsWithBrace(con) ? " else" : "\nelse",
                adjustClause(print(n.alternate)));

        return concat(parts);

    case Syntax.ForStatement:
        var init = print(n.init),
            sep = init.length > 1 ? ";\n" : "; ",
            forParen = "for (",
            indented = fromString(sep).join([
                init,
                print(n.test),
                print(n.update)
            ]).indentTail(forParen.length),
            head = concat([forParen, indented, ")"]),
            clause = adjustClause(print(n.body)),
            parts = [head];

        if (head.length > 1) {
            parts.push("\n");
            clause = clause.trimLeft();
        }

        parts.push(clause);

        return concat(parts);

    case Syntax.WhileStatement:
        return concat([
            "while (",
            print(n.test),
            ")",
            adjustClause(print(n.body))
        ]);

    case Syntax.ForInStatement:
        // Note: esprima can't actually parse "for each (".
        return concat([
            n.each ? "for each (" : "for (",
            print(n.left),
            " in ",
            print(n.right),
            ")",
            adjustClause(print(n.body))
        ]);

    case Syntax.DoWhileStatement:
        var doBody = concat([
            "do",
            adjustClause(print(n.body))
        ]), parts = [doBody];

        if (endsWithBrace(doBody))
            parts.push(" while");
        else
            parts.push("\nwhile");

        parts.push(" (", print(n.test), ");");

        return concat(parts);

    case Syntax.BreakStatement:
        var parts = ["break"];
        if (n.label)
            parts.push(" ", print(n.label));
        return concat(parts);

    case Syntax.ContinueStatement:
        var parts = ["continue"];
        if (n.label)
            parts.push(" ", print(n.label));
        return concat(parts);

    case Syntax.LabeledStatement:
        return concat([
            print(n.label),
            ":\n",
            print(n.body)
        ]);

    case Syntax.TryStatement:
        var parts = [
            "try ",
            print(n.block),
            fromString(" ").join(n.handlers.map(print))
        ];

        if (n.finalizer)
            parts.push(" finally ", print(n.finalizer));

        return concat(parts);

    case Syntax.CatchClause:
        var parts = [" catch(", print(n.param)];

        if (n.guard)
            // Note: esprima does not recognize conditional catch clauses.
            parts.push(" if ", print(n.guard));

        parts.push(") ", print(n.body));

        return concat(parts);

    case Syntax.ThrowStatement:
        return concat([
            "throw ",
            print(n.argument)
        ]);

    case Syntax.SwitchStatement:
        return concat([
            "switch (",
            print(n.discriminant),
            ") {\n",
            fromString("\n").join(n.cases.map(print)),
            "}"
        ]);

        // Note: ignoring n.lexical because it has no printing consequences.

    case Syntax.SwitchCase:
        var parts = [];

        if (n.test)
            parts.push("case ", print(n.test), ":");
        else
            parts.push("default:");

        if (n.consequent.length > 0)
            parts.push(printNakedBlockStatement({
                type: Syntax.BlockStatement,
                body: n.consequent
            }, print));

        return concat(parts);

    case Syntax.DebuggerStatement:
        return fromString("debugger");

    default:
        debugger;
        throw new Error("unknown type: " + JSON.stringify(n));
    }

    return p;
}

function printNakedBlockStatement(node, print) {
    assert.strictEqual(node.type, Syntax.BlockStatement);

    var allowBreak = false,
        len = node.body.length,
        parts = [];

    node.body.map(print).forEach(function(lines, i) {
        var multiLine = lines.length > 1;
        if (multiLine && allowBreak) {
            // Insert an additional line break before multi-line
            // statements, if we did not insert an extra line break
            // after the previous statement.
            parts.push("\n");
        }

        parts.push(maybeAddSemicolon(lines));

        if (i < len - 1) {
            // Add an extra line break if the previous statement
            // spanned multiple lines.
            parts.push(multiLine ? "\n\n" : "\n");

            // Avoid adding another line break if we just added an
            // extra one.
            allowBreak = !multiLine;
        }
    });

    return concat(parts);
}

function adjustClause(clause) {
    if (clause.length > 1)
        return concat([" ", clause]);

    return concat([
        "\n",
        maybeAddSemicolon(clause).indent(4)
    ]);
}

function lastNonSpaceCharacter(lines) {
    var pos = lines.lastPos();
    do {
        var ch = lines.charAt(pos);
        if (/\S/.test(ch))
            return ch;
    } while (lines.prevPos(pos));
}

function endsWithBrace(lines) {
    return lastNonSpaceCharacter(lines) === "}";
}

function nodeStrEscape(str) {
    return str.replace(/\\/g, "\\\\")
              .replace(/"/g, "\\\"")
              // The previous line messes up my syntax highlighting
              // unless this comment includes a " character.
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\r")
              .replace(/</g, "\\u003C")
              .replace(/>/g, "\\u003E");
}

function nodeStr(n) {
    if (/[\u0000-\u001F\u0080-\uFFFF]/.test(n.value)) {
        // use the convoluted algorithm to avoid broken low/high characters
        var str = "";
        for (var i = 0; i < n.value.length; i++) {
            var c = n.value[i];
            if (c <= "\x1F" || c >= "\x80") {
                var cc = c.charCodeAt(0).toString(16);
                while (cc.length < 4) cc = "0" + cc;
                str += "\\u" + cc;
            } else {
                str += nodeStrEscape(c);
            }
        }
        return '"' + str + '"';
    }

    return '"' + nodeStrEscape(n.value) + '"';
}

function maybeAddSemicolon(lines) {
    var eoc = lastNonSpaceCharacter(lines);
    if ("\n};".indexOf(eoc) < 0)
        return concat([lines, ";"]);
    return lines;
}