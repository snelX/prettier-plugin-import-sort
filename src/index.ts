import path from "path";

import sortImports from "import-sort";
import { getConfig } from "import-sort-config";
import { parsers as javascriptParsers } from "prettier/parser-babel";
import { parsers as typescriptParsers } from "prettier/parser-typescript";

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
	const config = getAndCheckConfig(extension, dirname || path.resolve(__dirname, "..", ".."));
	const { parser, style, config: rawConfig } = config;

	const sortResult = sortImports(unsortedCode, parser!, style!, typeof filepath === "string" ? filepath : `dummy${extension}`, rawConfig.options);
	return sortResult.code;
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
