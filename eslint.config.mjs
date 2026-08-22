import typescriptEslint from "typescript-eslint";

export default [{
    files: ["**/*.ts"],
}, {
    plugins: {
        "@typescript-eslint": typescriptEslint.plugin,
    },

    languageOptions: {
        parser: typescriptEslint.parser,
        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/naming-convention": ["warn", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],

        curly: "warn",
        eqeqeq: "warn",
        "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }],
        "no-throw-literal": "warn",
        semi: "warn",
    },
}, {
    // Test files carry exhaustive rule matrices; size is data, not design.
    files: ["src/test/**/*.ts"],
    rules: {
        "max-lines": "off",
    },
}];