import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, readPosts } from '../generator.js';
test('すべての投稿先でテーマと指定した事実を反映する', () => {
  for (const platform of ['instagram', 'threads', 'room']) {
    const text = generate({ theme: 'おうちカフェ', details: '青いマグを使います', platform });
    assert.match(text, /おうちカフェ/); assert.match(text, /青いマグを使います/);
  }
});
test('媒体別の文案を作り、未入力の体験を捏造しない', () => {
  assert.match(generate({ theme: 'マグ', platform: 'instagram' }), /#Shinvia/);
  assert.match(generate({ theme: 'マグ', platform: 'threads' }), /いますか？/);
  assert.match(generate({ theme: 'マグ', platform: 'room' }), /価格・仕様・在庫/);
  assert.match(generate({ theme: 'マグ', platform: 'room' }), /あなたの感想/);
});
test('空白テーマや不明な投稿先を拒否する', () => {
  assert.throws(() => generate({ theme: '  ', platform: 'instagram' }));
  assert.throws(() => generate({ theme: 'テスト', platform: 'unknown' }));
});
test('壊れた保存データでも起動でき、有効な投稿のみ読み込む', () => {
  assert.deepEqual(readPosts('{broken'), []); assert.deepEqual(readPosts('{}'), []);
  const post = { id: '1', theme: 'テーマ', text: '<script>test</script>', platform: 'room', date: new Date().toISOString() };
  assert.deepEqual(readPosts(JSON.stringify([null, {}, post])), [post]);
});
