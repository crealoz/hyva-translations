<?php

namespace Crealoz\HyvaTranslations\Model\Js;

use Magento\Framework\App\State;
use Magento\Framework\App\Utility\Files;
use Magento\Framework\Filesystem\File\ReadFactory;
use Magento\Framework\Phrase\RendererInterface;
use Magento\Translation\Model\Js\DataProviderInterface;
use Psr\Log\LoggerInterface;

class DataProvider implements DataProviderInterface
{
    /**
     * Combined regex pattern for all translation functions.
     * Matches: $t('...'), $t("..."), $t(`...`), __('...'), __("..."), $this->__('...'), $this->__("...")
     */
    private const TRANSLATION_PATTERN = '/(?:'
        . '\$t\s*\(\s*\'([^\'\\\\]*(?:\\\\.[^\'\\\\]*)*)\'\s*(?:,|\))'  // $t('...')
        . '|'
        . '\$t\s*\(\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"\s*(?:,|\))'      // $t("...")
        . '|'
        . '\$t\s*\(\s*`([^`\\\\]*(?:\\\\.[^`\\\\]*)*)`\s*(?:,|\))'      // $t(`...`)
        . '|'
        . '(?:__|\$this->__)\s*\(\s*\'([^\'\\\\]*(?:\\\\.[^\'\\\\]*)*)\'\s*(?:,|\))' // __('...') or $this->__('...')
        . '|'
        . '(?:__|\$this->__)\s*\(\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"\s*(?:,|\))'     // __("...") or $this->__("...")
        . ')/mU';

    public function __construct(
        private readonly State $appState,
        private readonly Files $filesUtility,
        private readonly ReadFactory $fileReadFactory,
        private readonly RendererInterface $translate,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * Gets translation data for a given theme. Only returns phrases which are actually translated.
     *
     * @param string $themePath The path to the theme
     * @return array A string array where the key is the phrase and the value is the translated phrase.
     */
    public function getData($themePath): array
    {
        $areaCode = $this->appState->getAreaCode();

        /**
         * Get all relevant JS and PHTML files from the base theme and the specified theme.
         */
        $files = array_merge(
            $this->filesUtility->getJsFiles('base', $themePath),
            $this->filesUtility->getJsFiles($areaCode, $themePath),
            $this->filesUtility->getPhtmlFiles()
        );

        $dictionary = [];
        foreach ($files as $filePath) {
            try {
                $read = $this->fileReadFactory->create($filePath[0], \Magento\Framework\Filesystem\DriverPool::FILE);
                $content = $read->readAll();
            } catch (\Exception $e) {
                $this->logger->warning(
                    'Failed to read file for translation extraction',
                    ['file' => $filePath[0], 'exception' => $e->getMessage()]
                );
                continue;
            }

            foreach ($this->getPhrases($content) as $phrase) {
                try {
                    $translatedPhrase = $this->translate->render([$phrase], []);
                    if ($phrase != $translatedPhrase) {
                        $dictionary[$phrase] = $translatedPhrase;
                    }
                } catch (\Exception $e) {
                    $this->logger->warning(
                        'Error while translating phrase',
                        [
                            'phrase' => $phrase,
                            'file' => $filePath[0],
                            'exception' => $e->getMessage()
                        ]
                    );
                    // Continue processing other phrases instead of stopping
                    continue;
                }
            }
        }

        ksort($dictionary);

        return $dictionary;
    }

    /**
     * Extract phrases from a string using a single optimized regex pattern.
     *
     * This method looks for common translation function patterns in JavaScript and PHP code,
     * such as $t('string'), __('string'), and $this->__('string'), and extracts the phrases
     * used for translation.
     *
     * @param string $string The input string to search for translation phrases.
     * @return array An array of unique phrases found in the input string.
     */
    protected function getPhrases($string): array
    {
        $found = [];

        if (!is_string($string) || $string === '') {
            return [];
        }

        if (preg_match_all(self::TRANSLATION_PATTERN, $string, $matches)) {
            // Process all capture groups (1-5 correspond to different patterns)
            for ($i = 1; $i <= 5; $i++) {
                if (!isset($matches[$i])) {
                    continue;
                }
                foreach ($matches[$i] as $raw) {
                    if ($raw === '' || $raw === null) {
                        continue;
                    }
                    // Unescape escaped sequences like \' \" \\ and trim whitespace
                    $key = stripcslashes($raw);
                    $key = trim($key);
                    if ($key !== '') {
                        $found[$key] = true;
                    }
                }
            }
        }

        // return unique keys
        return array_keys($found);
    }
}