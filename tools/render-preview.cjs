#!/usr/bin/env node
/* 从 src/pages/index/index.ux 生成与真机同源的 HTML 预览（无第三方模板引擎）。
   用途：在无 Vela 模拟器的环境下，按 336×480 渲染同款布局做视觉验证 & 截图。
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ux = fs.readFileSync(path.join(ROOT, 'src/pages/index/index.ux'), 'utf8');
const tpl = ux.match(/<template>([\s\S]*?)<\/template>/)[1];
const sty = ux.match(/<style>([\s\S]*?)<\/style>/)[1];
const scr = ux.match(/<script>([\s\S]*?)<\/script>/)[1];

const sandbox = { module: { exports: {} } };
vm.runInNewContext(scr.replace(/export\s+default\s*/, 'module.exports = '), sandbox);
const model = sandbox.module.exports;
const data = model.data || {};

function renderLoops(html) {
  return html.replace(/<div([^>]*?)for="\{\{(\w+)\}\}"([^>]*)>([\s\S]*?)<\/div>/g, (m, pre, name, post, inner) => {
    const arr = data[name] || [];
    return arr.map((item) => {
      const s = inner.replace(/\{\{\s*\$item\.(\w+)\s*\}\}/g, (mm, k) => (item[k] === undefined ? '' : item[k]));
      return '<div' + pre + post + '>' + s + '</div>';
    }).join('\n');
  });
}

let html = renderLoops(tpl)
  .replace(/<image([^>]*?)><\/image>/g, '<img$1>')
  .replace(/<image([^>]*?)\/>/g, '<img$1>')
  .replace(/src="\/common\//g, 'src="../src/common/')
  .replace(/<text/g, '<div')
  .replace(/<\/text>/g, '</div>')
  .replace(/\stid="[^"]*"/g, '');

const css = '*{box-sizing:border-box;border-style:solid;border-width:0;margin:0;padding:0;}'
  + 'div{display:flex;flex-direction:row;align-items:flex-start;justify-content:flex-start;}'
  + 'html,body{margin:0;padding:0;background:#050a14;}'
  + 'body{font-family:"Noto Sans CJK SC","Noto Sans SC","DejaVu Sans",sans-serif;}'
  + 'img{display:block;}'
  + sty;

const out = '<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="UTF-8">'
  + '<title>Vela 天气页预览 336×480</title><style>' + css + '</style></head><body>'
  + html + '</body></html>';

const dir = path.join(ROOT, 'preview');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.html'), out);
console.log('preview written:', path.join(dir, 'index.html'), out.length, 'bytes');
