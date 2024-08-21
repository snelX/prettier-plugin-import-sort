# @snelx/prettier-plugin-import-sort

[Prettier] plugin to pass javascript and typescript through import-sort for Commonjs and ESM using [import-sort].

[Prettier]: https://github.com/prettier/prettier
[import-sort]: https://github.com/renke/import-sort

## Installation

```bash
$ pnpm i -D prettier @snelx/prettier-plugin-import-sort
```

You will also want to install an import sort style `module` of your choice, such as: 

```bash
pnpm i -D import-sort-style-module
#or
pnpm i -D import-sort-style-eslint
```

You will then need the configuration for `import-sorts` available, e.g.

```json
// In package.json
"importSort": {
    ".js, .jsx, .ts, .tsx": {
      "style": "module",
    }
  }
```

If you are using typescript, you may also need to specify the typescript parser. e.g.

```json
// In package.json
"importSort": {
    ".js, .jsx, .ts, .tsx": {
      "style": "module",
      "parser": "typescript"
    }
  }
```

Note: importSort silently falls back to its default configuration if it finds a setup error. Make sure that the extension list is like the example above and not something like `"*.js"` which is an error.


### Credits:

A large part of this code was copied from import-sort-cli.
