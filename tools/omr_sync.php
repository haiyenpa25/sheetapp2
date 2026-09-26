<?php
/**
 * OMR Sync Tool
 * Bơm dữ liệu nốt nhạc từ file XML do AI tạo ra (raw_xml) vào Structure Template chuẩn.
 */

if (php_sapi_name() !== 'cli') {
    die("This tool can only be run from the command line.");
}

if ($argc < 4) {
    echo "Usage: php omr_sync.php <template_xml> <raw_xml> <output_xml>\n";
    exit(1);
}

$templatePath = $argv[1];
$rawPath = $argv[2];
$outputPath = $argv[3];

if (!file_exists($templatePath)) die("Template not found: $templatePath\n");
if (!file_exists($rawPath)) die("Raw XML not found: $rawPath\n");

// Load Template
$templateDom = new DOMDocument();
$templateDom->preserveWhiteSpace = false;
$templateDom->formatOutput = true;
$templateDom->load($templatePath);

// Load Raw OMR XML
$rawDom = new DOMDocument();
$rawDom->preserveWhiteSpace = false;
$rawDom->load($rawPath);

// --- BƯỚC 1: Lấy các measure từ Part P1 của Raw XML ---
$rawPart = null;
$rawParts = $rawDom->getElementsByTagName('part');
foreach ($rawParts as $p) {
    if ($p->getAttribute('id') === 'P1') {
        $rawPart = $p;
        break;
    }
}
if (!$rawPart && $rawParts->length > 0) {
    $rawPart = $rawParts->item(0); // Lấy part đầu tiên nếu không có P1
}
if (!$rawPart) die("No <part> found in raw XML.\n");

$rawMeasures = [];
foreach ($rawPart->getElementsByTagName('measure') as $measure) {
    $rawMeasures[] = $measure;
}
if (count($rawMeasures) === 0) die("No <measure> found in raw XML.\n");

echo "Extracted " . count($rawMeasures) . " measures from raw XML.\n";

// --- BƯỚC 2: Rỗng Part P1 của Template ---
$templatePart = null;
$templateParts = $templateDom->getElementsByTagName('part');
foreach ($templateParts as $p) {
    if ($p->getAttribute('id') === 'P1') {
        $templatePart = $p;
        break;
    }
}
if (!$templatePart) die("No <part id='P1'> found in template.\n");

// Xóa trắng nội dung cũ của P1 trong Template
while ($templatePart->hasChildNodes()) {
    $templatePart->removeChild($templatePart->firstChild);
}

// Giữ lại thẻ P2 nếu có? Template chuẩn có thể có P2, nhưng ta đang sửa P1. 
// Tạm thời nếu Template có P2 ta kệ nó (nó sẽ hiện thị như 1 bè bass trống, hoặc ta phải xoá nếu không muốn).
// Tốt nhất là xoá luôn các bè không phải P1 để tránh mâu thuẫn giao diện.
$partsToRemove = [];
foreach ($templateParts as $p) {
    if ($p->getAttribute('id') !== 'P1') {
        $partsToRemove[] = $p;
    }
}
foreach ($partsToRemove as $p) {
    $p->parentNode->removeChild($p);
}

// Bơm measure từ Raw vào Template P1
foreach ($rawMeasures as $measure) {
    $importedMeasure = $templateDom->importNode($measure, true);
    $templatePart->appendChild($importedMeasure);
}

// --- BƯỚC 3: Cập nhật Movement Title ---
$titles = $templateDom->getElementsByTagName('movement-title');
if ($titles->length > 0) {
    $titles->item(0)->nodeValue = "Bản nháp - Đang đồng bộ (" . date('H:i d/m') . ")";
}
$creditWords = $templateDom->getElementsByTagName('credit-words');
foreach ($creditWords as $cw) {
    if ($cw->getAttribute('font-size') === '22') { // Header lớn
        $cw->nodeValue = "Bản Nháp Nhận Diện";
    }
}

// Lưu lại
$templateDom->save($outputPath);
echo "Successfully synced to $outputPath\n";
