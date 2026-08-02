import typescript, { type CommentRange, type ImportDeclaration, type SourceFile } from "typescript";

type ImportType = "import" | "require" | "import-equals" | "import-type";

interface NamedMember {
	name: string;
	alias: string;
	type?: boolean;
}

interface IImport {
	start: number;
	end: number;
	importStart?: number;
	importEnd?: number;
	type: ImportType;
	moduleName: string;
	defaultMember?: string;
	namespaceMember?: string;
	namedMembers: NamedMember[];
}

function parseImports(code: string): IImport[] {
	const host: typescript.CompilerHost = {
		fileExists: () => true,
		readFile: () => "",
		getSourceFile: () => {
			return typescript.createSourceFile("", code, typescript.ScriptTarget.Latest, true);
		},
		getDefaultLibFileName: () => "lib.d.ts",
		writeFile: () => null,
		getCurrentDirectory: () => "",
		getDirectories: () => [],
		getCanonicalFileName: fileName => fileName,
		useCaseSensitiveFileNames: () => true,
		getNewLine: () => typescript.sys.newLine
	};

	const program = typescript.createProgram(
		["foo.ts"],
		{
			noResolve: true,
			target: typescript.ScriptTarget.Latest,
			experimentalDecorators: true
		},
		host
	);

	const sourceFile = program.getSourceFile("foo.ts");

	if (!sourceFile) {
		throw new Error("Source file not found. This should not happen.");
	}

	const imports: IImport[] = [];

	typescript.forEachChild(sourceFile, node => {
		switch (node.kind) {
			case typescript.SyntaxKind.ImportDeclaration: {
				imports.push(parseImportDeclaration(code, sourceFile, node as ImportDeclaration));
				break;
			}
			default: {
				break;
			}
		}
	});

	return imports;
}

function parseImportDeclaration(code: string, sourceFile: SourceFile, importDeclaration: ImportDeclaration): IImport {
	const importStart = importDeclaration.pos + importDeclaration.getLeadingTriviaWidth();
	const importEnd = importDeclaration.end;

	let start = importStart;
	let end = importEnd;

	const leadingComments = getComments(sourceFile, importDeclaration, false);
	const trailingComments = getComments(sourceFile, importDeclaration, true);

	if (leadingComments) {
		const comments = leadingComments;
		let current = leadingComments.length - 1;
		let previous: number | undefined;

		while (comments[current] && comments[current].end + 1 === start) {
			if (
				code
					.substring(comments[current].pos, comments[current].end)
					.startsWith("#!")
			) {
				break;
			}

			previous = current;
			start = comments[previous].pos;
			current -= 1;
		}
	}

	if (trailingComments) {
		const comments = trailingComments;
		let current = 0;
		let previous: number | undefined;

		while (comments[current] && comments[current].pos - 1 === end) {
			previous = current;
			({ end } = comments[previous]);
			current += 1;
		}
	}

	const moduleName = importDeclaration.moduleSpecifier.getText().replace(/["']/g, "");

	const imported: IImport = {
		start,
		end,
		importStart,
		importEnd,
		type: importDeclaration.importClause?.isTypeOnly ? "import-type" : "import",
		moduleName,
		namedMembers: []
	};

	const { importClause } = importDeclaration;

	if (importClause) {
		if (importClause.name) {
			imported.defaultMember = importClause.name.text;
		}

		const { namedBindings } = importClause;

		if (namedBindings) {
			if (namedBindings.kind === typescript.SyntaxKind.NamespaceImport) {
				imported.namespaceMember = namedBindings.name.text;
			}

			if (namedBindings.kind === typescript.SyntaxKind.NamedImports) {
				for (const element of namedBindings.elements) {
					const alias = element.name.text;
					let name = alias;

					if (element.propertyName) {
						name = element.propertyName.text;
					}

					imported.namedMembers.push({
						name: fixMultipleUnderscore(name),
						alias: fixMultipleUnderscore(alias),
						...(element.isTypeOnly ? { type: true } : {})
					});
				}
			}
		}
	}

	return imported;
}

// This hack circumvents a bug (?) in the TypeScript parser where a named
// binding's name or alias that consists only of underscores contains an
// additional underscore. We just remove the superfluous underscore here.
//
// See https://github.com/renke/import-sort/issues/18 for more details.
function fixMultipleUnderscore(name: string): string {
	if (name.match(/^_{2,}$/)) {
		return name.substring(1);
	}

	return name;
}

// Taken from https://github.com/fkling/astexplorer/blob/master/src/parsers/js/typescript.js#L68
function getComments(sourceFile: SourceFile, node: typescript.Node, isTrailing: boolean): CommentRange[] | undefined {
	if (node.parent) {
		const nodePos = isTrailing ? node.end : node.pos;
		const parentPos = isTrailing ? node.parent.end : node.parent.pos;

		if (node.parent.kind === typescript.SyntaxKind.SourceFile || nodePos !== parentPos) {
			let comments: CommentRange[] | undefined;

			if (isTrailing) {
				comments = typescript.getTrailingCommentRanges(sourceFile.text, nodePos);
			} else {
				comments = typescript.getLeadingCommentRanges(sourceFile.text, nodePos);
			}

			if (Array.isArray(comments)) {
				return comments;
			}
		}
	}

	return undefined;
}

function formatImport(code: string, imported: IImport, eol = "\n"): string {
	const importStart = imported.importStart || imported.start;
	const importEnd = imported.importEnd || imported.end;

	const importCode = code.substring(importStart, importEnd);

	const { namedMembers } = imported;

	if (namedMembers.length === 0) {
		return code.substring(imported.start, imported.end);
	}

	const newImportCode = importCode.replace(/\{[\s\S]*\}/g, namedMembersString => {
		const useMultipleLines = namedMembersString.indexOf(eol) !== -1;

		let prefix: string | undefined;

		if (useMultipleLines) {
			[prefix] = namedMembersString.split(eol)[1].match(/^\s*/) ?? [""];
		}

		const useSpaces = namedMembersString.charAt(1) === " ";

		const userTrailingComma = namedMembersString.replace("}", "").trim().endsWith(",");

		return formatNamedMembers(namedMembers, useMultipleLines, useSpaces, userTrailingComma, prefix, eol);
	});

	return code.substring(imported.start, importStart) + newImportCode + code.substring(importEnd, importEnd + (imported.end - importEnd));
}

function formatNamedMembers(
	namedMembers: NamedMember[],
	useMultipleLines: boolean,
	useSpaces: boolean,
	useTrailingComma: boolean,
	prefix: string | undefined,
	eol = "\n"
): string {
	if (useMultipleLines) {
		return (
			"{" +
			eol +
			namedMembers
				.map(({ name, alias, type }, index) => {
					const lastImport = index === namedMembers.length - 1;
					const comma = !useTrailingComma && lastImport ? "" : ",";
					const typeModifier = type ? "type " : "";

					if (name === alias) {
						return `${prefix}${typeModifier}${name}${comma}` + eol;
					}

					return `${prefix}${typeModifier}${name} as ${alias}${comma}` + eol;
				})
				.join("") +
			"}"
		);
	}

	const space = useSpaces ? " " : "";
	const comma = useTrailingComma ? "," : "";

	return (
		"{" +
		space +
		namedMembers
			.map(({ name, alias, type }) => {
				const typeModifier = type ? "type " : "";

				if (name === alias) {
					return `${typeModifier}${name}`;
				}

				return `${typeModifier}${name} as ${alias}`;
			})
			.join(", ") +
		comma +
		space +
		"}"
	);
}

export { parseImports, formatImport };
