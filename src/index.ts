import path from "path";

import sortImports from "import-sort";
import { getConfig } from "import-sort-config";
import { parsers as javascriptParsers } from "prettier/parser-babel";
import { parsers as typescriptParsers } from "prettier/parser-typescript";

import * as typescriptParser from "./parsers/typescript.js";

function getAndCheckConfig(extension: string, fileDirectory?: string) {
	const resolvedConfig = getConfig(extension, fileDirectory);
	if (!resolvedConfig) {
		throw new Error(`@snelx/prettier-plugin-import-sort: No configuration found for file type ${extension}`);
	}
	const rawParser = resolvedConfig.config.parser;
	const rawStyle = resolvedConfig.config.style;
	if (!rawParser) {
		throw new Error(`@snelx/prettier-plugin-import-sort: No parser defined for file type ${extension}`);
	}
	if (!rawStyle) {
		throw new Error(`@snelx/prettier-plugin-import-sort: No style defined for file type ${extension}`);
	}
	return resolvedConfig;
}

function organizeImports(unsortedCode: string, extension: string, dirname: string | null, filepath: string | undefined): string {
	const config = getAndCheckConfig(extension, dirname || process.cwd());
	const { parser, style, config: rawConfig } = config;

	const usesTypescriptParser = rawConfig.parser === "typescript" || /import-sort-parser-typescript/.test(String(parser));
	const effectiveParser = usesTypescriptParser ? typescriptParser : parser!;

	const originalConsoleLog = console.log;
	console.log = () => {};

	try {
		const sortResult = sortImports(unsortedCode, effectiveParser, style!, typeof filepath === "string" ? filepath : `dummy${extension}`, rawConfig.options);
		return sortResult.code;
	} finally {
		console.log = originalConsoleLog;
	}
}

const parsers = {
	typescript: {
		...typescriptParsers.typescript,
		preprocess(text: string, opts: { filepath?: string }) {
			let extname = ".ts";
			let dirname: string | null = null;

			if (typeof opts.filepath === "string") {
				extname = path.extname(opts.filepath);
				dirname = path.dirname(opts.filepath);
			}

			return organizeImports(text, extname, dirname, opts.filepath);
		}
	},
	babel: {
		...javascriptParsers.babel,
		preprocess(text: string, opts: { filepath?: string }) {
			let extname = ".js";
			let dirname: string | null = null;

			if (typeof opts.filepath === "string") {
				extname = path.extname(opts.filepath);
				dirname = path.dirname(opts.filepath);
			}

			return organizeImports(text, extname, dirname, opts.filepath);
		}
	}
};

export { parsers };
