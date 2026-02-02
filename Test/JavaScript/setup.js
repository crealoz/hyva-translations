/**
 * Jest setup file - resets globals before each test
 */

beforeEach(() => {
    // Reset all global variables used by translations.js
    delete global.HYVA_DEFAULT_TRANSLATIONS;
    delete global.$t;
    delete global.HyvaTranslations;
    delete global.Alpine;
    delete global.__HyvaTranslationsDebug;

    // Clear all intervals/timeouts that might be running from previous tests
    jest.clearAllTimers();

    // Reset any event listeners
    if (typeof document !== 'undefined') {
        // Create fresh document body
        document.body.innerHTML = '';
    }
});

afterEach(() => {
    // Clean up after each test
    jest.clearAllTimers();
    jest.useRealTimers();
});
