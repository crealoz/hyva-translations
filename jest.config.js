/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['**/Test/JavaScript/**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/Test/JavaScript/setup.js'],
    verbose: true,
    collectCoverageFrom: [
        'view/frontend/web/js/**/*.js'
    ],
    coverageDirectory: 'coverage/js',
    coverageReporters: ['text', 'lcov', 'html']
};
