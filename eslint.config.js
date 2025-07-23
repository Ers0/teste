import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import hooksPlugin from "eslint-plugin-react-hooks";

export default [
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  { ...pluginReactConfig, files: ["**/*.{jsx,tsx}"] },
  {
    plugins: {
      "react-hooks": hooksPlugin,
    },
    rules: {
      ...hooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/jsx-no-target-blank": "off",
    },
  },
];