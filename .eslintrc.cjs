module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  plugins: ['simple-import-sort'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          ['^react$', '^next', '^@?\\w'],
          ['^@/'],
          ['^\\.']
        ]
      }
    ],
    'simple-import-sort/exports': 'error'
  }
};