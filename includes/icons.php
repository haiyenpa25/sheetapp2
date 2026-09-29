<?php
// includes/icons.php — Lucide SVG Icon Helper (Ticket R1-1)

if (!function_exists('icon')) {
    /**
     * Render an inline SVG icon referencing the Lucide SVG sprite symbol.
     *
     * @param string $name  Name of the icon (matches #icon-$name)
     * @param string $class Extra CSS class names (e.g. 'icon-sm', 'text-accent')
     * @param array  $attrs Additional HTML attributes
     * @return string Valid SVG element HTML
     */
    function icon(string $name, string $class = '', array $attrs = []): string {
        $classes = trim('icon icon-' . $name . ($class ? ' ' . $class : ''));
        $attrStr = '';
        foreach ($attrs as $k => $v) {
            $attrStr .= ' ' . htmlspecialchars($k, ENT_QUOTES, 'UTF-8') . '="' . htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8') . '"';
        }
        return '<svg class="' . htmlspecialchars($classes, ENT_QUOTES, 'UTF-8') . '" aria-hidden="true"' . $attrStr . '><use href="#icon-' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '"/></svg>';
    }
}
