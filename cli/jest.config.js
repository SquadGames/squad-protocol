/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 68,
      statements: 84,
      lines: 84,
      functions: 90
    }
  },
  displayName: '@squad/cli',
  roots: [
    'test'
  ]
}
