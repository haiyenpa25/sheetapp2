<?php
declare(strict_types=1);

/** Seed only the PDO supplied by an in-memory test or explicitly marked HTTP clone. */
function seedTv41Setlists(PDO $pdo): array {
    $token = 'TV41-' . bin2hex(random_bytes(5));
    $owner = (int)$pdo->query("SELECT id FROM users WHERE username='admin'")->fetchColumn();
    $song = (string)$pdo->query("SELECT id FROM songs WHERE is_public=1 AND visibility='public' ORDER BY id LIMIT 1")->fetchColumn();
    $plan = $pdo->prepare("INSERT INTO setlists(title,created_by,leader_user_id,scheduled_date,service_time,status,description) VALUES(?,?,?,'2026-10-19','08:30',?,?)");
    $ids = [];
    foreach (['draft', 'published', 'completed'] as $status) {
        $plan->execute([$token . '-' . $status, $owner, $owner, $status, $token . '-PRIVATE-DESCRIPTION']);
        $ids[$status] = (int)$pdo->lastInsertId();
        $pdo->prepare("INSERT INTO setlist_items(setlist_id,song_id,display_order,chord_profile,transpose_key,bpm,beats_per_measure,leader_notes) VALUES(?,?,0,'HD',2,88,3,?)")
            ->execute([$ids[$status], $song, $token . '-PRIVATE-NOTE']);
        $pdo->prepare("INSERT INTO service_plan_assignments(setlist_id,user_id,role,notes) VALUES(?,?,'piano',?)")
            ->execute([$ids[$status], $owner, $token . '-PRIVATE-ASSIGNMENT']);
        $pdo->prepare("INSERT INTO song_usage_history(song_id,setlist_id,service_date,chord_profile,transpose_key) VALUES(?,?,'2026-10-19','HD',2)")
            ->execute([$song, $ids[$status]]);
    }
    return $ids + ['token' => $token, 'song' => $song];
}
