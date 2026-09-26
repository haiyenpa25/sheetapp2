<?php
require_once __DIR__ . '/../api/core/DB.php';
$db = DB::get();
$songs = $db->query("SELECT id, title, defaultKey FROM songs WHERE defaultKey = 'Eb' LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($songs, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
