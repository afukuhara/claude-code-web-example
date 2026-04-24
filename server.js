'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { checkAndTranslate, loadData } = require('./translator');

const PORT = process.env.PORT || 3000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  if (req.url === '/api/translations') {
    const data = loadData();
    sendJson(res, 200, data);
    return;
  }

  if (req.url === '/api/check' && req.method === 'POST') {
    try {
      const result = await checkAndTranslate();
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);

  // 毎日 JST 10:00 (UTC 01:00) に実行
  cron.schedule('0 1 * * *', async () => {
    console.log('定期チェック開始...');
    try {
      await checkAndTranslate();
    } catch (err) {
      console.error('定期チェックエラー:', err.message);
    }
  });

  console.log('定期翻訳スケジュール設定完了 (毎日 JST 10:00 / UTC 01:00)');
});
