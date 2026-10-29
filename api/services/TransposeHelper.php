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

        $idx = self::noteChroma($root);
        if ($idx === -1) {
            return $chord;
        }

        $isMinorOrDim = self::isMinorOrDimSuffix($suffix);
        $newRoot = self::resolveRootSpell((($idx + $semitones) % 12 + 12) % 12, $isMinorOrDim, $useFlats, $root);
        $result = $newRoot . $suffix;

        if ($bass !== null) {
            $bi = self::noteChroma($bass);
            $newBass = ($bi !== -1)
                ? self::resolveBassSpell((($bi + $semitones) % 12 + 12) % 12, $newRoot, $isMinorOrDim, $useFlats)
                : $bass;
            $result .= '/' . $newBass;
        }

        return $result;
    }

    private static function isMinorOrDimSuffix(string $suffix): bool {
        return preg_match('/^(m(?!aj)|min|dim|ø|°|-)/iu', $suffix) === 1;
    }

    private static function noteChroma(string $note): int {
        if ($note === '') {
            return -1;
        }
        $clean = strtoupper($note[0]) . ($note[1] ?? '');
        $idx = array_search($clean, self::NOTES_SHARP, true);
        if ($idx === false) {
            $idx = array_search($clean, self::NOTES_FLAT, true);
        }
        if ($idx !== false) {
            return (int)$idx;
        }
        return ['Cb' => 11, 'B#' => 0, 'Fb' => 4, 'E#' => 5][$clean] ?? -1;
    }

    /**
     * Chọn tên gốc hợp âm chuẩn Thánh Ca (RULE.md §1.1): hợp âm trưởng ở bậc 3/8/10 luôn là Eb/Ab/Bb;
     * hợp âm thứ/dim theo dấu hoá của tông.
     */
    private static function resolveRootSpell(int $chroma, bool $isMinorOrDim, ?bool $useFlats, string $origRoot): string {
        $origHasFlat  = str_contains($origRoot, 'b') || $origRoot === 'F';
        $origHasSharp = str_contains($origRoot, '#');

        if (!$isMinorOrDim) {
            if ($chroma === 3) return 'Eb';
            if ($chroma === 8) return 'Ab';
            if ($chroma === 10) return 'Bb';
            if ($chroma === 1) {
                if ($useFlats === true) return 'Db';
                if ($useFlats === false) return 'C#';
                return $origHasFlat ? 'Db' : (in_array($origRoot, ['D', 'B'], true) ? 'C#' : 'Db');
            }
            if ($chroma === 6) {
                if ($useFlats === true) return 'Gb';
                if ($useFlats === false) return 'F#';
                return $origHasFlat ? 'Gb' : 'F#';
            }
            return self::NOTES_FLAT[$chroma];
        }

        switch ($chroma) {
            case 1:  return ($useFlats === true && $origHasFlat) ? 'Db' : 'C#';
            case 3:  return ($useFlats === true || ($useFlats === null && $origHasFlat)) ? 'Eb' : 'D#';
            case 6:  return ($useFlats === true && $origHasFlat) ? 'Gb' : 'F#';
            case 8:  return ($useFlats === true || ($useFlats === null && $origHasFlat)) ? 'Ab' : 'G#';
            case 10: return ($useFlats === false || ($useFlats === null && $origHasSharp)) ? 'A#' : 'Bb';
            default: return self::NOTES_FLAT[$chroma];
        }
    }

    private static function resolveBassSpell(int $chroma, string $newRoot, bool $isMinorOrDim, ?bool $useFlats): string {
        if (
            str_contains($newRoot, 'b') || $newRoot === 'F'
            || ($isMinorOrDim && in_array($newRoot, ['C', 'F', 'G', 'D', 'Bb', 'Eb', 'Ab'], true))
        ) {
            return self::NOTES_FLAT[$chroma];
        }
        if (
            str_contains($newRoot, '#')
            || (!$isMinorOrDim && in_array($newRoot, ['G', 'D', 'A', 'E', 'B'], true))
            || ($isMinorOrDim && in_array($newRoot, ['E', 'B'], true))
        ) {
            return self::NOTES_SHARP[$chroma];
        }
        if ($useFlats === true) return self::NOTES_FLAT[$chroma];
        if ($useFlats === false) return self::NOTES_SHARP[$chroma];
        return in_array($chroma, [3, 8, 10], true) ? self::NOTES_FLAT[$chroma] : self::NOTES_SHARP[$chroma];
    }
}
