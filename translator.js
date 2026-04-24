'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');

const FEED_URL = 'https://simonwillison.net/atom/entries/';
const DATA_FILE = path.join(__dirname, 'data', 'translations.json');

const client = new Anthropic();

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
});

async function fetchFeed() {
  const res = await fetch(FEED_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BlogTranslatorBot/1.0)',
      'Accept': 'application/atom+xml, application/xml, text/xml',
    },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: HTTP ${res.status}`);
  return res.text();
}

function parseEntries(xml) {
  const parsed = xmlParser.parse(xml);
  const feed = parsed.feed || parsed['atom:feed'] || parsed;
  const rawEntries = feed.entry || [];
  const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];

  return entries.map(e => {
    const link = Array.isArray(e.link) ? e.link[0] : e.link;
    const href = link?.['@_href'] || (typeof link === 'string' ? link : '');
    const id = e.id || href;

    const content = e.content?.['#text'] || e.content?.['__cdata'] ||
      (typeof e.content === 'string' ? e.content : '') ||
      e.summary?.['#text'] || e.summary?.['__cdata'] ||
      (typeof e.summary === 'string' ? e.summary : '');

    const title = e.title?.['#text'] || e.title?.['__cdata'] ||
      (typeof e.title === 'string' ? e.title : '') || '(無題)';

    return {
      id,
      url: href,
      title_en: title,
      published: e.published || e.updated || '',
      content_html: content,
    };
  }).filter(e => e.id && e.url);
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

async function translateEntry(entry) {
  const plainContent = stripHtml(entry.content_html);

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: 'あなたは英語から日本語への翻訳専門家です。ブログ記事のタイトルと概要を自然な日本語に翻訳してください。技術用語は適切に訳すか、カタカナで表記してください。',
    messages: [
      {
        role: 'user',
        content: `以下のブログ記事を日本語に翻訳してください。

タイトル: ${entry.title_en}

本文（抜粋）:
${plainContent}

以下のJSON形式で返してください:
{
  "title_ja": "日本語タイトル",
  "summary_ja": "日本語での概要（2〜3文）"
}`,
      },
    ],
  });

  const text = message.content[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Translation response had no JSON');

  const result = JSON.parse(jsonMatch[0]);
  return {
    title_ja: result.title_ja || entry.title_en,
    summary_ja: result.summary_ja || '',
  };
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { entries: [], last_checked: null };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { entries: [], last_checked: null };
  }
}

function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function checkAndTranslate() {
  console.log(`[${new Date().toISOString()}] ブログをチェック中...`);

  const data = loadData();
  const existingIds = new Set(data.entries.map(e => e.id));

  let xml;
  try {
    xml = await fetchFeed();
  } catch (err) {
    console.error('フィードの取得に失敗:', err.message);
    data.last_checked = new Date().toISOString();
    data.last_error = err.message;
    saveData(data);
    return { newCount: 0, error: err.message };
  }

  const feedEntries = parseEntries(xml);
  const newEntries = feedEntries.filter(e => !existingIds.has(e.id));

  console.log(`新しい記事: ${newEntries.length}件`);

  const translated = [];
  for (const entry of newEntries) {
    try {
      console.log(`翻訳中: ${entry.title_en}`);
      const t = await translateEntry(entry);
      const record = {
        id: entry.id,
        url: entry.url,
        title_en: entry.title_en,
        title_ja: t.title_ja,
        summary_ja: t.summary_ja,
        published: entry.published,
        translated_at: new Date().toISOString(),
      };
      translated.push(record);
      data.entries.unshift(record);
      saveData(data);
      console.log(`完了: ${t.title_ja}`);
    } catch (err) {
      console.error(`翻訳エラー (${entry.title_en}):`, err.message);
    }
  }

  data.last_checked = new Date().toISOString();
  delete data.last_error;
  saveData(data);

  console.log(`チェック完了。翻訳済み: ${translated.length}件`);
  return { newCount: translated.length };
}

module.exports = { checkAndTranslate, loadData };

if (require.main === module) {
  checkAndTranslate().catch(console.error);
}
