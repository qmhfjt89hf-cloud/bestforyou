<?php
header('Content-Type: application/json; charset=utf-8');

// ❌ защита от прямого открытия в браузере
if ($_SERVER['REQUEST_METHOD'] !== 'GET' || empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$config = require __DIR__ . '/../config/env.php';

$token = $config['VK_TOKEN'];
$groupId = (int) $config['GROUP_ID'];
$ttl = (int) $config['CACHE_TTL'];

$cacheFile = __DIR__ . '/../cache/vk_cache.json';

// ================= CACHE =================
if (file_exists($cacheFile)) {
    if (time() - filemtime($cacheFile) < $ttl) {
        readfile($cacheFile);
        exit;
    }
}

// ================= VK REQUEST =================
$params = http_build_query([
    'owner_id' => -$groupId,
    'count' => 5,
    'access_token' => $token,
    'v' => '5.199'
]);

$url = "https://api.vk.com/method/wall.get?$params";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true
]);

$response = curl_exec($ch);
curl_close($ch);

if (!$response) {
    http_response_code(500);
    echo json_encode(['error' => 'VK request failed']);
    exit;
}

// ================= SAVE CACHE =================
file_put_contents($cacheFile, $response);

echo $response;
