import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "site");

const htmlFiles = readdirSync(SITE_DIR, { recursive: true })
  .filter((f) => f.endsWith(".html"))
  .map((f) => join(SITE_DIR, f));

const read = (file) => readFileSync(file, "utf8");
const rel = (file) => relative(SITE_DIR, file);

// 属性値を全て取り出す(例: attrValues(html, "a", "href"))
function attrValues(html, tag, attr) {
  const values = [];
  const tagRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const attrRe = new RegExp(`\\s${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  for (const [tagText] of html.matchAll(tagRe)) {
    const m = tagText.match(attrRe);
    if (m) values.push(m[1] ?? m[2]);
  }
  return values;
}

const isExternal = (url) => /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url);

// リンク先を実ファイルのパスに解決する(クエリ・フラグメントは除去)
function resolveLocal(htmlFile, url) {
  const clean = url.split("#")[0].split("?")[0];
  return clean.startsWith("/")
    ? join(SITE_DIR, clean)
    : resolve(dirname(htmlFile), clean);
}

function isFile(p) {
  return existsSync(p) && statSync(p).isFile();
}

test("検査対象のHTMLファイルがsite配下に1つ以上存在する", () => {
  assert.ok(htmlFiles.length > 0, "site配下にHTMLファイルが見つかりません");
});

test("全HTMLにtitle要素(空でない)とhtmlのlang属性がある", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    assert.ok(title && title[1].trim() !== "", `${rel(file)}: titleがない、または空です`);
    assert.ok(
      /<html\b[^>]*\slang\s*=\s*["'][^"']+["']/i.test(html),
      `${rel(file)}: <html>にlang属性がありません`
    );
  }
});

test("全てのimg要素にalt属性がある", () => {
  for (const file of htmlFiles) {
    const imgs = read(file).match(/<img\b[^>]*>/gi) ?? [];
    for (const img of imgs) {
      assert.ok(/\salt\s*=\s*["'][^"']*["']/i.test(img), `${rel(file)}: altのないimgがあります: ${img}`);
    }
  }
});

test("HTML内の内部リンク(href)が実在するファイルを指している", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    const hrefs = [...attrValues(html, "a", "href"), ...attrValues(html, "link", "href")];
    for (const href of hrefs) {
      if (isExternal(href)) continue;
      assert.ok(isFile(resolveLocal(file, href)), `${rel(file)}: リンク切れ href="${href}"`);
    }
  }
});

test("HTMLが参照するCSS/JSファイルが実在する", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    const cssLinks = (html.match(/<link\b[^>]*>/gi) ?? [])
      .filter((tag) => /\srel\s*=\s*["']?stylesheet/i.test(tag))
      .flatMap((tag) => attrValues(tag, "link", "href"));
    const scripts = attrValues(html, "script", "src");
    for (const url of [...cssLinks, ...scripts]) {
      if (isExternal(url)) continue;
      assert.ok(isFile(resolveLocal(file, url)), `${rel(file)}: 参照ファイルが存在しません "${url}"`);
    }
  }
});
