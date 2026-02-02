(function (global) {
    'use strict';

    // Debug mode: set window.__HyvaTranslationsDebug = true to enable console logging
    function debug(message, data) {
        if (global.__HyvaTranslationsDebug) {
            if (data !== undefined) {
                console.warn('[HyvaTranslations]', message, data);
            } else {
                console.warn('[HyvaTranslations]', message);
            }
        }
    }

    // Internal dictionary (initialized lazily)
    let DICT = (global.HYVA_DEFAULT_TRANSLATIONS && typeof global.HYVA_DEFAULT_TRANSLATIONS === 'object')
        ? global.HYVA_DEFAULT_TRANSLATIONS
        : {};

    let DICT_READY = (DICT && Object.keys(DICT).length > 0);

    function ensureDict() {
        try {
            if (typeof DICT === 'undefined' || DICT === null) {
                DICT = {};
            }
        } catch (e) {
            debug('Error checking DICT:', e);
            DICT = {};
        }
        if ((!DICT || Object.keys(DICT).length === 0) && global.HYVA_DEFAULT_TRANSLATIONS && typeof global.HYVA_DEFAULT_TRANSLATIONS === 'object') {
            DICT = global.HYVA_DEFAULT_TRANSLATIONS;
            DICT_READY = Object.keys(DICT).length > 0;
        }
        if (!DICT || typeof DICT !== 'object') DICT = {};
    }

    // Replace %1 %2 ... with params (1-based)
    function replaceNumberedPlaceholders(str, params) {
        if (!params || params.length === 0) return str;
        let out = String(str);
        for (let i = 0; i < params.length; i++) {
            const token = '%' + (i + 1);
            out = out.split(token).join(String(params[i]));
        }
        return out;
    }

    // Replace {name} placeholders using object map
    function replaceNamedPlaceholders(str, map) {
        if (!map || typeof map !== 'object') return str;
        return String(str).replace(/\{([^\}]+)\}/g, (m, key) => {
            return (key in map) ? String(map[key]) : m;
        });
    }

    // Synchronous translate
    function translate(key /* , ...params */) {
        if (key === null || key === undefined) return '';

        ensureDict();

        const phraseKey = String(key);
        let translated = (DICT && Object.prototype.hasOwnProperty.call(DICT, phraseKey)) ? DICT[phraseKey] : phraseKey;

        if (arguments.length <= 1) return translated;

        const params = Array.prototype.slice.call(arguments, 1);
        if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) {
            return replaceNamedPlaceholders(translated, params[0]);
        }
        return replaceNumberedPlaceholders(translated, params);
    }

    /**
     * Validate that an object contains only string keys and string values.
     * @param {Object} obj - The object to validate
     * @returns {Object} - A sanitized object with only valid string key/value pairs
     */
    function validateTranslationObject(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            debug('Invalid translation object (not an object or is array)');
            return {};
        }

        const sanitized = {};
        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) {
                continue;
            }
            // Skip prototype pollution attempts
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                debug('Blocked potential prototype pollution key:', key);
                continue;
            }
            if (typeof key !== 'string') {
                debug('Invalid translation key (not a string):', key);
                continue;
            }
            if (typeof obj[key] !== 'string') {
                debug('Invalid translation value for key (not a string):', { key: key, value: obj[key] });
                continue;
            }
            sanitized[key] = obj[key];
        }
        return sanitized;
    }

    // Allow external code to set/merge translations programmatically
    function setTranslations(obj, merge) {
        if (merge === undefined) merge = true;

        const validated = validateTranslationObject(obj);
        if (Object.keys(validated).length === 0) {
            debug('No valid translations to set');
            return;
        }

        if (merge) {
            DICT = Object.assign({}, DICT, validated);
        } else {
            DICT = Object.assign({}, validated);
        }
        global.HYVA_DEFAULT_TRANSLATIONS = DICT;
        DICT_READY = Object.keys(DICT).length > 0;

        try {
            const ev = new CustomEvent('hyva:translations:updated', { detail: { translations: DICT }});
            global.dispatchEvent(ev);
        } catch (e) {
            debug('Failed to dispatch translations:updated event:', e);
        }
    }

    function getTranslations() {
        ensureDict();
        return DICT;
    }

    /**
     * Parse JSON params safely with validation.
     * @param {string} rawParams - The raw params string from data-i18n-params
     * @returns {Object|Array|null} - Parsed params or null if invalid
     */
    function parseJsonParams(rawParams) {
        if (!rawParams || typeof rawParams !== 'string') {
            return null;
        }

        try {
            const parsed = JSON.parse(rawParams);
            // Validate that parsed result is an object (for named params) or array (for numbered params)
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
            debug('Parsed JSON is not an object or array:', parsed);
            return null;
        } catch (e) {
            debug('Failed to parse JSON params:', { rawParams: rawParams, error: e.message });
            return null;
        }
    }

    // expose globals
    global.$t = translate;
    global.HyvaTranslations = {
        t: translate,
        set: setTranslations,
        get: getTranslations,
        // convenience: force pickup from global var immediately (merge=false by default)
        pickup: function (merge) {
            if (merge === undefined) merge = false;
            if (global.HYVA_DEFAULT_TRANSLATIONS && typeof global.HYVA_DEFAULT_TRANSLATIONS === 'object') {
                setTranslations(global.HYVA_DEFAULT_TRANSLATIONS, merge);
            }
        },
        // refresh hook for DOM updates (if you keep refresh implementation)
        refresh: function (selector) {
            // minimal DOM refresh (keeps compatibility if you use data-i18n-key)
            try {
                const sel = selector || '[data-i18n-key]';
                if (typeof document === 'undefined') return;
                const nodes = document.querySelectorAll(sel);
                nodes.forEach(function (node) {
                    const key = node.getAttribute('data-i18n-key');
                    if (!key) return;
                    const rawParams = node.getAttribute('data-i18n-params');
                    let result;
                    if (rawParams) {
                        const parsed = parseJsonParams(rawParams);
                        if (parsed !== null) {
                            // Valid JSON - use as params
                            if (Array.isArray(parsed)) {
                                result = translate.apply(null, [key].concat(parsed));
                            } else {
                                result = translate(key, parsed);
                            }
                        } else {
                            // Invalid JSON - treat as single string parameter
                            result = translate(key, rawParams);
                        }
                    } else {
                        result = translate(key);
                    }
                    if ('value' in node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
                        node.value = result;
                    } else {
                        node.textContent = result;
                    }
                });
            } catch (e) {
                debug('Error in refresh:', e);
            }
        }
    };

    // Alpine integration (register $t magic)
    function registerAlpineMagic(Alpine) {
        try {
            if (typeof Alpine.magic === 'function') {
                Alpine.magic('t', function () {
                    return function () {
                        return translate.apply(null, arguments);
                    };
                });
            }
        } catch (e) {
            debug('Failed to register Alpine magic:', e);
        }
    }

    if (global.Alpine) {
        registerAlpineMagic(global.Alpine);
    } else {
        const MAX_ATTEMPTS = 20;
        let attempts = 0;
        const poll = setInterval(function () {
            attempts++;
            if (global.Alpine) {
                clearInterval(poll);
                registerAlpineMagic(global.Alpine);
                return;
            }
            if (attempts >= MAX_ATTEMPTS) {
                clearInterval(poll);
                debug('Alpine not found after ' + MAX_ATTEMPTS + ' attempts');
            }
        }, 50);
    }

    // pickup short window: if window.HYVA_DEFAULT_TRANSLATIONS injected shortly after
    if (!global.HYVA_DEFAULT_TRANSLATIONS || Object.keys(global.HYVA_DEFAULT_TRANSLATIONS).length === 0) {
        const MAX_PICKUP = 40;
        let pickupAttempts = 0;
        const pickup = setInterval(function () {
            pickupAttempts++;
            if (global.HYVA_DEFAULT_TRANSLATIONS && typeof global.HYVA_DEFAULT_TRANSLATIONS === 'object'
                && Object.keys(global.HYVA_DEFAULT_TRANSLATIONS).length > 0) {
                setTranslations(global.HYVA_DEFAULT_TRANSLATIONS, false);
                clearInterval(pickup);
                return;
            }
            if (pickupAttempts >= MAX_PICKUP) {
                clearInterval(pickup);
                debug('Translations not found after ' + MAX_PICKUP + ' pickup attempts');
            }
        }, 25);
    }

    // explicit injection event
    function onInjectEvent(e) {
        if (!e || !e.detail) {
            debug('Invalid injection event (missing detail)');
            return;
        }
        // Support both e.detail.translations and e.detail directly as translation object
        const translations = e.detail.translations || e.detail;
        if (!translations || typeof translations !== 'object') {
            debug('Invalid injection event (no translations in detail)');
            return;
        }
        setTranslations(translations, true);
    }

    try {
        global.addEventListener('hyva:translations:inject', onInjectEvent);
    } catch (e) {
        debug('Failed to register injection listener:', e);
    }

})(window);