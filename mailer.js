'use strict';

const nodemailer = require('nodemailer');

function isConfigured() {
  return !!(process.env.MAIL_HOST && process.env.MAIL_TO);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    auth: process.env.MAIL_USER ? {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    } : undefined,
  });
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
    });
  } catch { return iso; }
}

function buildHtml(entries) {
  const items = entries.map(e => `
    <div style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #e5e5e0;">
      <div style="font-size:12px;color:#aaa;margin-bottom:4px;">${formatDate(e.published)}</div>
      <div style="font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:4px;">${esc(e.title_ja)}</div>
      <div style="font-size:12px;color:#888;margin-bottom:10px;">${esc(e.title_en)}</div>
      ${e.summary_ja ? `<div style="font-size:14px;color:#444;border-left:3px solid #e94560;padding-left:10px;margin-bottom:12px;">${esc(e.summary_ja)}</div>` : ''}
      <a href="${esc(e.url)}" style="font-size:13px;color:#e94560;font-weight:600;text-decoration:none;">元記事を読む →</a>
    </div>
  `).join('');

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
  });

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Hiragino Sans','Yu Gothic',sans-serif;background:#f5f5f0;margin:0;padding:20px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#1a1a2e;color:#fff;padding:20px 28px;">
      <div style="font-size:18px;font-weight:700;">Simon Willison's Blog</div>
      <div style="font-size:13px;opacity:0.7;margin-top:4px;">日本語翻訳 — ${today}</div>
    </div>
    <div style="padding:24px 28px;">
      <p style="font-size:14px;color:#555;margin-bottom:24px;">本日 ${entries.length} 件の新しい記事が投稿されました。</p>
      ${items}
    </div>
    <div style="background:#f5f5f0;padding:14px 28px;font-size:11px;color:#aaa;">
      このメールは自動送信されています。元ブログ: <a href="https://simonwillison.net/" style="color:#e94560;">simonwillison.net</a>
    </div>
  </div>
</body>
</html>`;
}

function buildText(entries) {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
  });
  const lines = [
    `Simon Willison's Blog 日本語翻訳 — ${today}`,
    `新着記事: ${entries.length}件`,
    '',
  ];
  for (const e of entries) {
    lines.push(`■ ${e.title_ja}`);
    lines.push(`  [${e.title_en}]`);
    if (e.published) lines.push(`  ${formatDate(e.published)}`);
    if (e.summary_ja) lines.push(`  ${e.summary_ja}`);
    lines.push(`  ${e.url}`);
    lines.push('');
  }
  return lines.join('\n');
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendTranslationMail(entries) {
  if (!isConfigured()) {
    console.log('メール設定なし (MAIL_HOST / MAIL_TO が未設定)。スキップします。');
    return;
  }
  if (entries.length === 0) return;

  const transporter = createTransporter();
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
  });
  const subject = `[Simon Willison] ${entries.length}件の新着記事 (${today})`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: process.env.MAIL_TO,
    subject,
    text: buildText(entries),
    html: buildHtml(entries),
  });

  console.log(`メール送信完了: ${subject} → ${process.env.MAIL_TO}`);
}

module.exports = { sendTranslationMail, isConfigured };
