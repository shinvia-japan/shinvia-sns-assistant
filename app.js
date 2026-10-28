import { requestAI, platforms, readPosts, draftLengthHint } from './generator.js';
const $ = id => document.getElementById(id);
const key = 'shinvia.posts.v1';
let posts = [], currentId = null, activePlatform = 'instagram', activeTheme = '', generating = false;
let storageAvailable = true;
try { posts = readPosts(localStorage.getItem(key)); } catch { storageAvailable = false; }
function notify(message) { $('status').textContent = message; }
function persist(next) {
  try { localStorage.setItem(key, JSON.stringify(next)); posts = next; render(); return true; }
  catch { notify('保存できませんでした。ブラウザの保存設定や空き容量を確認し、文章をコピーしてください。'); return false; }
}
function updateCount() {
  const count = Array.from($('draft').value).length;
  $('count').textContent = `${count.toLocaleString('ja-JP')}文字`;
  $('length-hint').textContent = draftLengthHint($('draft').value, activePlatform);
}
function openEditor(text) {
  $('empty-state').hidden = true; $('editor-area').hidden = false;
  $('draft').value = text; $('platform-label').textContent = platforms[activePlatform];
  $('save').textContent = currentId ? '変更を保存する' : '保存する'; updateCount();
}
function hasUnsaved() {
  if ($('editor-area').hidden) return false;
  const saved = posts.find(p => p.id === currentId);
  return $('draft').value.trim() !== '' && (!saved || saved.text !== $('draft').value);
}
function canReplace() { return !hasUnsaved() || confirm('保存していない文案があります。文案を置き換えますか？'); }
function setGenerating(value) {
  generating = value;
  $('create-form').querySelectorAll('input, textarea, select, button').forEach(control => { control.disabled = value; });
  $('draft').readOnly = value;
  $('save').disabled = value;
  $('create-form').setAttribute('aria-busy', String(value));
}
$('create-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (generating) return;
  if (!$('theme').value.trim()) { notify('投稿テーマを入力してください。'); $('theme').focus(); return; }
  if (!canReplace()) return;
  const platform = new FormData(event.currentTarget).get('platform');
  const theme = $('theme').value.trim();
  const details = $('details').value;
  const tone = $('tone').value;
  $('generation-error').hidden = true;
  // Runtime input only: never persist authentication in code or browser storage.
  const token = prompt('Shinviaの認証トークンを入力してください（保存されません）');
  if (token === null) { notify('AI生成をキャンセルしました。以前の文案はそのままです。'); return; }
  setGenerating(true);
  notify('AIで文案を作成しています。しばらくお待ちください。');
  try {
    const text = await requestAI({ platform, theme, details, tone, token });
    // Commit editor metadata only after a valid response has arrived.
    activePlatform = platform; activeTheme = theme; currentId = null;
    openEditor(text);
    notify('文案を作成しました。医薬品・健康情報は公的資料や添付文書で確認してください。');
  } catch (error) {
    $('generation-error').textContent = `${error.message} 以前の文案は変更していません。`;
    $('generation-error').hidden = false;
    notify('生成できませんでした。入力フォームのエラーをご確認ください。');
  } finally {
    setGenerating(false);
  }
});
$('draft').addEventListener('input', updateCount);
$('save').addEventListener('click', () => {
  if (!$('draft').value.trim()) { notify('保存する文章を入力してください。'); return; }
  const id = currentId || crypto.randomUUID();
  const post = { id, theme: activeTheme, platform: activePlatform, text: $('draft').value, date: new Date().toISOString() };
  if (persist([post, ...posts.filter(p => p.id !== id)])) { currentId = id; $('save').textContent = '変更を保存する'; notify('このブラウザに保存しました。'); }
});
$('copy').addEventListener('click', async () => {
  if (!$('draft').value.trim()) { notify('コピーする文章を入力してください。'); return; }
  try { await navigator.clipboard.writeText($('draft').value); notify('コピーしました。SNSの投稿画面に貼り付けてください。'); }
  catch { $('draft').focus(); $('draft').select(); notify('自動コピーが使えません。選択した文章を Ctrl+C（Macは⌘C）または長押しでコピーしてください。'); }
});
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => { $('theme').value = button.dataset.example; $('theme').focus(); }));
function render() {
  $('saved-count').textContent = posts.length; $('saved-list').replaceChildren();
  if (!posts.length) { const empty = document.createElement('div'); empty.className = 'saved-empty'; empty.textContent = 'まだ保存した投稿はありません。作成した文案を保存すると、ここに表示されます。'; $('saved-list').append(empty); }
  for (const post of posts) {
    const article = document.createElement('article'); article.className = 'saved-post';
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = platforms[post.platform];
    const title = document.createElement('h3'); title.textContent = post.theme;
    const body = document.createElement('p'); body.textContent = post.text;
    const date = document.createElement('time'); date.dateTime = post.date; const timestamp = new Date(post.date); date.textContent = Number.isNaN(timestamp.getTime()) ? '保存日時不明' : timestamp.toLocaleString('ja-JP');
    const actions = document.createElement('div'); actions.className = 'post-buttons';
    const open = document.createElement('button'); open.className = 'secondary'; open.textContent = '開いて編集'; open.setAttribute('aria-label', `${post.theme}を開いて編集`);
    open.addEventListener('click', () => { if (generating) { notify('生成が終わるまでお待ちください。'); return; } if (!canReplace()) return; currentId = post.id; activePlatform = post.platform; activeTheme = post.theme; openEditor(post.text); $('draft').focus(); notify('保存した投稿を開きました。'); });
    const remove = document.createElement('button'); remove.className = 'delete'; remove.textContent = '削除'; remove.setAttribute('aria-label', `${post.theme}を削除`);
    remove.addEventListener('click', () => { if (generating) { notify('生成が終わるまでお待ちください。'); return; } if (confirm('この保存済み投稿を削除しますか？')) { if (persist(posts.filter(p => p.id !== post.id))) { if (currentId === post.id) { currentId = null; $('save').textContent = '保存する'; } notify('保存済み投稿を削除しました。'); } } });
    actions.append(open, remove); article.append(badge, title, body, date, actions); $('saved-list').append(article);
  }
}
window.addEventListener('beforeunload', event => { if (hasUnsaved()) { event.preventDefault(); event.returnValue = ''; } });
render();
if (!storageAvailable) notify('ブラウザの保存機能を利用できません。作成した文章はコピーして保管してください。');
