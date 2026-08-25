import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from '@typescript-eslint/eslint-plugin';

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'coverage/**',
      'report/**',
      'supabase/.temp/**',
      'next-env.d.ts',
    ],
  },

  // `core-web-vitals` já inclui as regras base do Next e as de TypeScript.
  ...nextCoreWebVitals,

  {
    // Limites da seção 20.4 do blueprint. Passar deles é sinal de módulo raso.
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'max-params': ['error', 4],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Marcadores pendentes são verificados por `npm run marcadores`, não aqui:
      // a regra do ESLint é insensível a maiúsculas e marcaria a palavra portuguesa "todo".
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  {
    // Em flat config o plugin precisa ser registrado no mesmo objeto que usa suas regras.
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // `any` é proibido: onde o tipo é desconhecido, `unknown` com narrowing.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // Scripts de apoio rodam em Node, fora do bundle da aplicação.
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },

  {
    // Testes descrevem cenários; limite de tamanho atrapalha sem proteger nada.
    files: ['**/*.test.ts', '**/*.test.tsx', 'testes/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },
];

export default config;
