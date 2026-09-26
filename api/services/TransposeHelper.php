<?php
/**
 * api/services/TransposeHelper.php
 *
 * Dịch giọng hợp âm chuẩn mực, đồng bộ 100% với assets/js/transpose-engine.js:
 * - Hỗ trợ dịch chuyển 12 bán âm (+ / -).
 * - Tự động nhận diện thăng (#) / giáng (b) từ hợp âm gốc (Bb -> flat, C# -> sharp).
 * - Hỗ trợ hợp âm phức tạp (m, 7, maj7, dim, sus4, add9, ...)
 * - Hỗ trợ Slash Chords / Hợp âm đảo (ví dụ: C/E, Bb/D, F#/A#).
 */

declare(strict_types=1);

class TransposeHelper {
    public const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    public const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

    /**
     * Tự động nhận diện xem hợp âm có sử dụng dấu giáng (b) không.
     */
    public static function hasFlat(string $chord): bool {
        if (preg_match('/^[A-G]([#b])/', $chord, $m)) {
            return $m[1] === 'b';
        }
        return false;
    }

    /**
     * Dịch tông một hợp âm hoàn chỉnh theo số bán âm (semitones).
     */
    public static function transpose(string $chord, int $semitones, ?bool $useFlats = null): string {
        $chord = trim($chord);
        if ($chord === '' || $semitones === 0) {
            return $chord;
        }

        if (!preg_match('/^([A-G][#b]?)([^\/]*)(\/([A-G][#b]?))?$/', $chord, $m)) {
            return $chord;
        }

        $root   = $m[1];
        $suffix = $m[2] ?? '';
        $bass   = $m[4] ?? null;

        if ($useFlats === null) {
            $useFlats = self::hasFlat($chord);
        }

        $arr = $useFlats ? self::NOTES_FLAT : self::NOTES_SHARP;

        $idx = array_search($root, self::NOTES_SHARP, true);
        if ($idx === false) {
            $idx = array_search($root, self::NOTES_FLAT, true);
        }
        if ($idx === false) {
            return $chord;
        }

        $newRoot = $arr[(($idx + $semitones) % 12 + 12) % 12];
        $result = $newRoot . $suffix;

        if ($bass !== null) {
            $bi = array_search($bass, self::NOTES_SHARP, true);
            if ($bi === false) {
                $bi = array_search($bass, self::NOTES_FLAT, true);
            }
            $newBass = ($bi !== false) ? $arr[(($bi + $semitones) % 12 + 12) % 12] : $bass;
            $result .= '/' . $newBass;
        }

        return $result;
    }
}
