/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Load the translations.js source code
const translationsJsPath = path.join(__dirname, '../../view/frontend/web/js/translations.js');
const translationsJsCode = fs.readFileSync(translationsJsPath, 'utf8');

// Load test fixtures
const fixturesPath = path.join(__dirname, 'fixtures/translations.json');
const testTranslations = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

// Helper to load the translations module into a fresh window context
function loadTranslationsModule(preloadTranslations = null) {
    // Set up translations before loading module
    if (preloadTranslations) {
        window.HYVA_DEFAULT_TRANSLATIONS = preloadTranslations;
    }

    // Execute the translations.js code in the window context
    const script = new Function(translationsJsCode);
    script();

    return {
        $t: window.$t,
        HyvaTranslations: window.HyvaTranslations
    };
}

describe('translations.js', () => {
    beforeEach(() => {
        // Reset window state
        delete window.HYVA_DEFAULT_TRANSLATIONS;
        delete window.$t;
        delete window.HyvaTranslations;
        delete window.Alpine;
        delete window.__HyvaTranslationsDebug;
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('$t() / translate()', () => {
        test('returns original key when no translation exists', () => {
            const { $t } = loadTranslationsModule({});
            expect($t('Unknown key')).toBe('Unknown key');
        });

        test('returns translated value when translation exists', () => {
            const { $t } = loadTranslationsModule(testTranslations);
            expect($t('Hello')).toBe('Bonjour');
        });

        test('returns empty string for null input', () => {
            const { $t } = loadTranslationsModule({});
            expect($t(null)).toBe('');
        });

        test('returns empty string for undefined input', () => {
            const { $t } = loadTranslationsModule({});
            expect($t(undefined)).toBe('');
        });

        test('converts non-string keys to strings', () => {
            const translations = { '123': 'one two three' };
            const { $t } = loadTranslationsModule(translations);
            expect($t(123)).toBe('one two three');
        });

        test('is case-sensitive', () => {
            const { $t } = loadTranslationsModule(testTranslations);
            expect($t('hello')).toBe('hello'); // lowercase not found
            expect($t('Hello')).toBe('Bonjour'); // exact case found
        });
    });

    describe('replaceNumberedPlaceholders()', () => {
        test('replaces single placeholder', () => {
            const translations = { 'Hello %1': 'Bonjour %1' };
            const { $t } = loadTranslationsModule(translations);
            expect($t('Hello %1', 'World')).toBe('Bonjour World');
        });

        test('replaces multiple placeholders', () => {
            const { $t } = loadTranslationsModule(testTranslations);
            expect($t('Hello %1, you have %2 messages', 'John', 5))
                .toBe('Bonjour John, vous avez 5 messages');
        });

        test('replaces repeated placeholders', () => {
            const translations = { '%1 and %1': '%1 et %1' };
            const { $t } = loadTranslationsModule(translations);
            expect($t('%1 and %1', 'test')).toBe('test et test');
        });

        test('leaves unreplaced placeholders intact', () => {
            const translations = { 'Hello %1 %2 %3': 'Bonjour %1 %2 %3' };
            const { $t } = loadTranslationsModule(translations);
            expect($t('Hello %1 %2 %3', 'A', 'B'))
                .toBe('Bonjour A B %3');
        });

        test('handles numeric parameters', () => {
            const translations = { 'Total: %1': 'Total: %1' };
            const { $t } = loadTranslationsModule(translations);
            expect($t('Total: %1', 42.5)).toBe('Total: 42.5');
        });

        test('returns string unchanged with no parameters', () => {
            const { $t } = loadTranslationsModule(testTranslations);
            expect($t('Hello')).toBe('Bonjour');
        });

        test('handles empty params array', () => {
            const translations = { 'Test %1': 'Test %1' };
            const { $t } = loadTranslationsModule(translations);
            // When called with no extra args, returns as-is
            expect($t('Test %1')).toBe('Test %1');
        });
    });

    describe('replaceNamedPlaceholders()', () => {
        test('replaces single named placeholder', () => {
            const { $t } = loadTranslationsModule(testTranslations);
            expect($t('Welcome {name}', { name: 'John' }))
                .toBe('Bienvenue John');
        });

        test('replaces multiple named placeholders', () => {
            const { $t } = loadTranslationsModule(testTranslations);
            expect($t('Hello {name}, you have {count} items', { name: 'John', count: 5 }))
                .toBe('Bonjour John, vous avez 5 articles');
        });

        test('leaves unknown placeholders intact', () => {
            const translations = { 'Hello {name} {unknown}': 'Bonjour {name} {unknown}' };
            const { $t } = loadTranslationsModule(translations);
            expect($t('Hello {name} {unknown}', { name: 'John' }))
                .toBe('Bonjour John {unknown}');
        });

        test('handles empty object', () => {
            const translations = { 'Hello {name}': 'Bonjour {name}' };
            const { $t } = loadTranslationsModule(translations);
            expect($t('Hello {name}', {})).toBe('Bonjour {name}');
        });

        test('converts values to strings', () => {
            const translations = { 'Count: {n}': 'Compte: {n}' };
            const { $t } = loadTranslationsModule(translations);
            expect($t('Count: {n}', { n: 42 })).toBe('Compte: 42');
        });
    });

    describe('validateTranslationObject()', () => {
        test('blocks __proto__ key (prototype pollution prevention)', () => {
            const { HyvaTranslations } = loadTranslationsModule({});

            // Attempt to inject __proto__
            const malicious = { '__proto__': { polluted: true }, 'valid': 'value' };
            HyvaTranslations.set(malicious);

            const translations = HyvaTranslations.get();
            expect(translations.valid).toBe('value');
            expect(Object.prototype.hasOwnProperty.call(translations, '__proto__')).toBe(false);
            expect(({}).polluted).toBeUndefined();
        });

        test('blocks constructor key', () => {
            const { HyvaTranslations } = loadTranslationsModule({});

            const malicious = { 'constructor': 'malicious', 'valid': 'value' };
            HyvaTranslations.set(malicious);

            const translations = HyvaTranslations.get();
            expect(translations.valid).toBe('value');
            expect(Object.prototype.hasOwnProperty.call(translations, 'constructor')).toBe(false);
        });

        test('blocks prototype key', () => {
            const { HyvaTranslations } = loadTranslationsModule({});

            const malicious = { 'prototype': 'malicious', 'valid': 'value' };
            HyvaTranslations.set(malicious);

            const translations = HyvaTranslations.get();
            expect(translations.valid).toBe('value');
            expect(translations.prototype).toBeUndefined();
        });

        test('filters out non-string values', () => {
            const { HyvaTranslations } = loadTranslationsModule({});

            const mixed = {
                'valid': 'string value',
                'number': 123,
                'object': { nested: true },
                'array': ['a', 'b'],
                'null': null,
                'bool': true
            };
            HyvaTranslations.set(mixed);

            const translations = HyvaTranslations.get();
            expect(translations.valid).toBe('string value');
            expect(translations.number).toBeUndefined();
            expect(translations.object).toBeUndefined();
            expect(translations.array).toBeUndefined();
            expect(translations.null).toBeUndefined();
            expect(translations.bool).toBeUndefined();
        });

        test('returns empty object for array input', () => {
            const { HyvaTranslations } = loadTranslationsModule({});

            HyvaTranslations.set(['not', 'valid']);

            // Should not crash and should keep existing (empty) translations
            const translations = HyvaTranslations.get();
            expect(Object.keys(translations).length).toBe(0);
        });

        test('returns empty object for null input', () => {
            const { HyvaTranslations } = loadTranslationsModule({ existing: 'value' });

            HyvaTranslations.set(null);

            // Should keep existing translations
            const translations = HyvaTranslations.get();
            expect(translations.existing).toBe('value');
        });
    });

    describe('setTranslations()', () => {
        test('sets translations dictionary', () => {
            const { HyvaTranslations, $t } = loadTranslationsModule({});

            HyvaTranslations.set({ 'Key': 'Value' });

            expect($t('Key')).toBe('Value');
        });

        test('merges translations by default', () => {
            const { HyvaTranslations, $t } = loadTranslationsModule({ 'Existing': 'Existant' });

            HyvaTranslations.set({ 'New': 'Nouveau' });

            expect($t('Existing')).toBe('Existant');
            expect($t('New')).toBe('Nouveau');
        });

        test('replaces translations when merge=false', () => {
            const { HyvaTranslations, $t } = loadTranslationsModule({ 'Existing': 'Existant' });

            HyvaTranslations.set({ 'New': 'Nouveau' }, false);

            expect($t('Existing')).toBe('Existing'); // No longer translated
            expect($t('New')).toBe('Nouveau');
        });

        test('updates window.HYVA_DEFAULT_TRANSLATIONS', () => {
            const { HyvaTranslations } = loadTranslationsModule({});

            HyvaTranslations.set({ 'Test': 'Testing' });

            expect(window.HYVA_DEFAULT_TRANSLATIONS.Test).toBe('Testing');
        });

        test('dispatches hyva:translations:updated event', () => {
            const { HyvaTranslations } = loadTranslationsModule({});

            const handler = jest.fn();
            window.addEventListener('hyva:translations:updated', handler);

            HyvaTranslations.set({ 'Key': 'Value' });

            expect(handler).toHaveBeenCalled();
            expect(handler.mock.calls[0][0].detail.translations.Key).toBe('Value');

            window.removeEventListener('hyva:translations:updated', handler);
        });
    });

    describe('HyvaTranslations.get()', () => {
        test('returns current dictionary', () => {
            const { HyvaTranslations } = loadTranslationsModule(testTranslations);

            const dict = HyvaTranslations.get();

            expect(dict.Hello).toBe('Bonjour');
            expect(dict.Goodbye).toBe('Au revoir');
        });
    });

    describe('HyvaTranslations.pickup()', () => {
        test('picks up translations from window.HYVA_DEFAULT_TRANSLATIONS', () => {
            const { HyvaTranslations, $t } = loadTranslationsModule({});

            // Simulate late injection of translations
            window.HYVA_DEFAULT_TRANSLATIONS = { 'Late': 'Tardif' };

            HyvaTranslations.pickup();

            expect($t('Late')).toBe('Tardif');
        });

        test('replaces by default (merge=false)', () => {
            const { HyvaTranslations, $t } = loadTranslationsModule({ 'Existing': 'Existant' });

            window.HYVA_DEFAULT_TRANSLATIONS = { 'New': 'Nouveau' };

            HyvaTranslations.pickup(); // default merge=false

            expect($t('Existing')).toBe('Existing'); // Lost
            expect($t('New')).toBe('Nouveau');
        });

        test('merges when merge=true', () => {
            const { HyvaTranslations, $t } = loadTranslationsModule({ 'Existing': 'Existant' });

            window.HYVA_DEFAULT_TRANSLATIONS = { 'New': 'Nouveau' };

            HyvaTranslations.pickup(true);

            expect($t('Existing')).toBe('Existant');
            expect($t('New')).toBe('Nouveau');
        });
    });

    describe('HyvaTranslations.refresh()', () => {
        test('updates elements with data-i18n-key', () => {
            const { HyvaTranslations } = loadTranslationsModule(testTranslations);

            document.body.innerHTML = '<span data-i18n-key="Hello">Hello</span>';

            HyvaTranslations.refresh();

            expect(document.querySelector('span').textContent).toBe('Bonjour');
        });

        test('handles input/textarea elements via value property', () => {
            const { HyvaTranslations } = loadTranslationsModule(testTranslations);

            document.body.innerHTML = '<input data-i18n-key="Hello" value="Hello">';

            HyvaTranslations.refresh();

            expect(document.querySelector('input').value).toBe('Bonjour');
        });

        test('handles textarea elements', () => {
            const { HyvaTranslations } = loadTranslationsModule(testTranslations);

            document.body.innerHTML = '<textarea data-i18n-key="Hello">Hello</textarea>';

            HyvaTranslations.refresh();

            expect(document.querySelector('textarea').value).toBe('Bonjour');
        });

        test('applies JSON array params from data-i18n-params', () => {
            const translations = { 'Hello %1 %2': 'Bonjour %1 %2' };
            const { HyvaTranslations } = loadTranslationsModule(translations);

            document.body.innerHTML =
                '<span data-i18n-key="Hello %1 %2" data-i18n-params=\'["World", "!"]\'></span>';

            HyvaTranslations.refresh();

            expect(document.querySelector('span').textContent).toBe('Bonjour World !');
        });

        test('applies JSON object params from data-i18n-params', () => {
            const { HyvaTranslations } = loadTranslationsModule(testTranslations);

            document.body.innerHTML =
                '<span data-i18n-key="Welcome {name}" data-i18n-params=\'{"name":"John"}\'></span>';

            HyvaTranslations.refresh();

            expect(document.querySelector('span').textContent).toBe('Bienvenue John');
        });

        test('handles invalid JSON params as single string parameter', () => {
            const translations = { 'Hello %1': 'Bonjour %1' };
            const { HyvaTranslations } = loadTranslationsModule(translations);

            document.body.innerHTML =
                '<span data-i18n-key="Hello %1" data-i18n-params="invalid json"></span>';

            HyvaTranslations.refresh();

            // Invalid JSON is treated as single string param
            expect(document.querySelector('span').textContent).toBe('Bonjour invalid json');
        });

        test('respects custom selector', () => {
            const { HyvaTranslations } = loadTranslationsModule(testTranslations);

            document.body.innerHTML = `
                <span data-i18n-key="Hello">Hello</span>
                <span class="custom" data-i18n-key="Goodbye">Goodbye</span>
            `;

            HyvaTranslations.refresh('.custom[data-i18n-key]');

            expect(document.querySelector('span:first-child').textContent).toBe('Hello'); // Not updated
            expect(document.querySelector('span.custom').textContent).toBe('Au revoir'); // Updated
        });

        test('skips elements without data-i18n-key value', () => {
            const { HyvaTranslations } = loadTranslationsModule(testTranslations);

            document.body.innerHTML = '<span data-i18n-key="">Empty key</span>';

            HyvaTranslations.refresh();

            expect(document.querySelector('span').textContent).toBe('Empty key');
        });
    });

    describe('Event handling', () => {
        test('responds to hyva:translations:inject event', () => {
            const { $t } = loadTranslationsModule({});

            const event = new CustomEvent('hyva:translations:inject', {
                detail: { 'Injected': 'Injecté' }
            });
            window.dispatchEvent(event);

            expect($t('Injected')).toBe('Injecté');
        });

        test('merges injected translations with existing', () => {
            const { $t } = loadTranslationsModule({ 'Existing': 'Existant' });

            const event = new CustomEvent('hyva:translations:inject', {
                detail: { 'New': 'Nouveau' }
            });
            window.dispatchEvent(event);

            expect($t('Existing')).toBe('Existant');
            expect($t('New')).toBe('Nouveau');
        });

        test('supports translations in detail.translations', () => {
            const { $t } = loadTranslationsModule({});

            const event = new CustomEvent('hyva:translations:inject', {
                detail: { translations: { 'Nested': 'Imbriqué' } }
            });
            window.dispatchEvent(event);

            expect($t('Nested')).toBe('Imbriqué');
        });

        test('ignores invalid injection events', () => {
            const { $t, HyvaTranslations } = loadTranslationsModule({ 'Keep': 'Garder' });

            // Event with no detail
            const event1 = new CustomEvent('hyva:translations:inject');
            window.dispatchEvent(event1);

            // Event with non-object detail
            const event2 = new CustomEvent('hyva:translations:inject', {
                detail: 'invalid'
            });
            window.dispatchEvent(event2);

            // Original translations should be preserved
            expect($t('Keep')).toBe('Garder');
        });
    });

    describe('Alpine.js integration', () => {
        test('registers $t magic when Alpine exists', () => {
            // Set up Alpine mock before loading module
            window.Alpine = {
                magic: jest.fn()
            };

            loadTranslationsModule(testTranslations);

            expect(window.Alpine.magic).toHaveBeenCalledWith('t', expect.any(Function));
        });

        test('waits for Alpine if not immediately available', () => {
            const { HyvaTranslations } = loadTranslationsModule(testTranslations);

            // Alpine not available yet
            expect(window.Alpine).toBeUndefined();

            // Simulate Alpine becoming available
            window.Alpine = { magic: jest.fn() };

            // Fast forward timers
            jest.advanceTimersByTime(100);

            expect(window.Alpine.magic).toHaveBeenCalledWith('t', expect.any(Function));
        });

        test('gives up waiting for Alpine after max attempts', () => {
            loadTranslationsModule(testTranslations);

            // Fast forward past max attempts (20 * 50ms = 1000ms)
            jest.advanceTimersByTime(1500);

            // Should not throw, just give up silently
            window.Alpine = { magic: jest.fn() };

            // More time passes but Alpine.magic should not be called
            jest.advanceTimersByTime(500);

            // Since we already passed max attempts, magic won't be registered
            // This test just ensures no errors are thrown
        });
    });

    describe('Automatic pickup', () => {
        test('auto-picks up translations injected shortly after load', () => {
            // Load module first without translations
            const { $t } = loadTranslationsModule();

            // Simulate translations being injected after module load
            window.HYVA_DEFAULT_TRANSLATIONS = { 'Late': 'Tardif' };

            // Fast forward timers (pickup interval is 25ms, max 40 attempts)
            jest.advanceTimersByTime(100);

            expect($t('Late')).toBe('Tardif');
        });
    });

    describe('Debug mode', () => {
        test('logs when debug mode enabled', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            window.__HyvaTranslationsDebug = true;

            const { HyvaTranslations } = loadTranslationsModule({});

            // Trigger something that logs
            HyvaTranslations.set({ '__proto__': 'malicious' });

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        test('does not log when debug mode disabled', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const { HyvaTranslations } = loadTranslationsModule({});

            // Trigger something that would log in debug mode
            HyvaTranslations.set({ '__proto__': 'malicious' });

            expect(consoleSpy).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });
});
