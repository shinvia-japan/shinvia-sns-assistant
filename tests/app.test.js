import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {platforms,readPosts,draftLengthHint} from '../generator.js';
const source=(await readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'');
function setup(requestAI, initialPosts = []) {
 const nodes=new Map(), storage=new Map();
 if (initialPosts.length) storage.set('shinvia.posts.v1', JSON.stringify(initialPosts));
 let selected='instagram', sequence=0, prompted=0,clipboard='';
 function element(){return {value:'',hidden:false,disabled:false,readOnly:false,listeners:{},children:[],textContent:'',addEventListener(t,f){this.listeners[t]=f},replaceChildren(){this.children=[]},append(...children){this.children.push(...children)},focus(){},setAttribute(){},querySelectorAll(){return []}}}
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 get('editor-area').hidden=true;get('theme').value='最初のテーマ';get('tone').value='friendly';
 vm.runInNewContext(source, {requestAI,platforms,readPosts,draftLengthHint,document:{getElementById:get,querySelectorAll:()=>[],createElement:element},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},window:{addEventListener(){}},navigator:{clipboard:{writeText:async t=>clipboard=t}},crypto:{randomUUID:()=>String(++sequence)},prompt:()=>{prompted++;return 'TEST_ONLY'},FormData:class{get(){return selected}},confirm:()=>true});
 return {get,storage,platform:p=>selected=p,prompted:()=>prompted,clipboard:()=>clipboard,submit:()=>get('create-form').listeners.submit({preventDefault(){},currentTarget:{}}),click:id=>get(id).listeners.click()};
}
test('生成失敗後も編集本文・媒体・保存先IDを保持し、上書き保存とコピーを維持する', async()=>{
 let fail=false;const app=setup(async()=>{if(fail)throw new Error('HTTP 401：認証を確認');return '元の投稿文'});
 await app.submit();app.click('save');app.get('draft').value='編集中の大切な本文';
 fail=true;app.platform('room');app.get('theme').value='別テーマ';await app.submit();
 assert.equal(app.get('draft').value,'編集中の大切な本文');assert.equal(app.get('platform-label').textContent,'Instagram');assert.equal(app.get('generation-error').hidden,false);assert.match(app.get('generation-error').textContent,/401/);
 app.click('save');const posts=JSON.parse(app.storage.get('shinvia.posts.v1'));assert.equal(posts.length,1);assert.equal(posts[0].theme,'最初のテーマ');assert.equal(posts[0].platform,'instagram');assert.equal(posts[0].text,'編集中の大切な本文');
 await app.click('copy');assert.equal(app.clipboard(),'編集中の大切な本文');assert.equal(app.get('save').disabled,false);
});
test('生成待ち中の重複送信を抑止し、完了後に編集を戻す',async()=>{
 let resolve,calls=0;const app=setup(()=>{calls++;return new Promise(r=>resolve=r)});
 const first=app.submit();await app.submit();assert.equal(calls,1);assert.equal(app.prompted(),1);assert.equal(app.get('draft').readOnly,true);assert.equal(app.get('save').disabled,true);
 resolve('新しい文案');await first;assert.equal(app.get('draft').readOnly,false);assert.equal(app.get('draft').value,'新しい文案');
});
test('Instagramの編集に応じて項目別文字数を更新し、本文を変更しない',async()=>{
 const text='【画像タイトル】\n確認\n【画像本文】\n一つの要点\n【投稿キャプション】\n本文\n【ハッシュタグ】\nなし\n【ファーストコメント】\n補足\n【ストーリーズ共有文】\n紹介';
 const app=setup(async()=>text);await app.submit();
 assert.match(app.get('length-hint').textContent,/キャプション＋ハッシュタグ 2文字/);
 app.get('draft').value=text.replace('\n本文\n','\n本文追記\n');app.get('draft').listeners.input();
 assert.match(app.get('length-hint').textContent,/キャプション＋ハッシュタグ 4文字/);
 app.click('save');await app.click('copy');
 assert.equal(app.clipboard(),text.replace('\n本文\n','\n本文追記\n'));
});
test('以前の単一本文の保存文も開いて編集・コピー・同一IDへの保存ができる',async()=>{
 const old={id:'legacy',theme:'以前の投稿',platform:'instagram',text:'見出しのない以前の文案 **手動入力**',date:'2026-10-01T00:00:00Z'};
 const app=setup(async()=>'', [old]);
 const article=app.get('saved-list').children[0];
 article.children.at(-1).children[0].listeners.click();
 assert.equal(app.get('draft').value,old.text);
 assert.match(app.get('length-hint').textContent,/判定できません/);
 app.get('draft').value=old.text+'\n追記';app.click('save');await app.click('copy');
 const posts=JSON.parse(app.storage.get('shinvia.posts.v1'));
 assert.equal(posts.length,1);assert.equal(posts[0].id,'legacy');assert.equal(posts[0].text,old.text+'\n追記');assert.equal(app.clipboard(),posts[0].text);
});
