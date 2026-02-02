# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-02-02

### Added
- PHPUnit test suite for `DataProvider` and `HyvaTranslations` block
- Jest test suite for `translations.js` frontend functionality
- GitHub Actions CI workflow for PHP 8.1, 8.2, 8.3 and Node.js 20
- Test fixtures for JS and PHTML translation patterns

### Testing Coverage
- Phrase extraction regex patterns (`$t()`, `__()`, `$this->__()`)
- Escaped character handling (`\'`, `\"`, `\\`)
- Translation caching with 24-hour TTL
- Numbered and named placeholder replacement
- Prototype pollution prevention
- Alpine.js `$t` magic integration
- Event-based translation injection

## [1.1.0] - 2025-01-15

### Added
- Initial release with Hyvä theme translation support
- `$t()` JavaScript translation function
- Alpine.js integration via `$t` magic helper
- Cached block with theme-specific cache keys
- Support for numbered (`%1`) and named (`{name}`) placeholders
