// eslint.config.js (Flat Config)
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import nodePlugin from "eslint-plugin-node";
import promisePlugin from "eslint-plugin-promise";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["dist/**", "build/**", "node_modules/**"],

    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: process.cwd(),
        sourceType: "module",
      },
      ecmaVersion: "latest",
    },

    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
      import: importPlugin,
      node: nodePlugin,
      promise: promisePlugin,
      "simple-import-sort": simpleImportSort,
      prettier: prettierPlugin,
    },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      },
    },
    rules: {
      // bring in TS recommended rules from the plugin
      ...typescriptEslintPlugin.configs.recommended.rules,

      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      "import/no-unresolved": "error",

      // We turn off ESLint core rule; line endings will be handled by Prettier/.gitattributes
      "linebreak-style": "off",

      "node/no-unsupported-features/es-syntax": "off",
      "node/no-extraneous-import": "off",

      ...promisePlugin.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,

      "prettier/prettier": "off",

      "no-console": "warn",
      "no-unused-vars": "off",
    },
  },

  // Apply Prettier last to disable conflicting rules
  prettierConfig,
];
