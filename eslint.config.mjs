import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    "next/core-web-vitals", 
    "next/typescript",
    "plugin:jsx-a11y/recommended"
  ),
  {
    rules: {
      // Accessibility rules (2025 standards)
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      // Allow keyboard events on navigation elements for accessibility
      'jsx-a11y/no-noninteractive-element-interactions': ['error', {
        handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'],
        alert: ['onKeyUp', 'onKeyDown', 'onKeyPress'],
        body: ['onError', 'onLoad'],
        dialog: ['onClick', 'onKeyUp', 'onKeyDown', 'onKeyPress'],
        iframe: ['onError', 'onLoad'],
        img: ['onError', 'onLoad'],
        nav: ['onKeyDown'], // Allow keyboard navigation on nav elements
      }],
      'jsx-a11y/no-noninteractive-tabindex': ['error', {
        tags: ['nav'], // Allow tabindex on nav elements for keyboard navigation
        roles: ['tabpanel'],
      }],
      
      // React best practices (2025 standards)
      'react-hooks/exhaustive-deps': 'error',
      'react/jsx-key': 'error',
      'react/no-array-index-key': 'warn',
      
      // TypeScript best practices (2025 standards)
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    }
  }
];

export default eslintConfig;
