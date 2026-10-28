import test from 'node:test';
import assert from 'node:assert/strict';
import { generationNotes, formatAIText, requestAI, instagramSections } from '../generator.js';
const reel = instagramSections.map(s => `【${s}】\n${s === 'ハッシュタグ' ? '#薬剤師 #健康 #暮らし #メモ #Shinvia #六個目 #健康' : '**説明**'}`).join('\n\n');
test('媒体ごとの指示・健康情報・使用経験・雰囲気を含める', () => {
 const ig = generationNotes({platform:'instagram',tone:'polite'});
 for (const value of ['約9秒','1枚完結','最大5個','正確性','用法用量','捏造','丁寧',...instagramSections]) assert.ok(ig.includes(value),value);
 assert.match(generationNotes({platform:'threads'}), /薬剤師の日常/);
 assert.match(generationNotes({platform:'room'}), /使用経験が明記されていなければ/);
});
test('Instagramを6項目に分け、Markdownを除去しハッシュタグは重複なし最大5個', () => {
 const out = formatAIText(`### 文案\n${reel}`, 'instagram');
 assert.equal((out.match(/#[\p{L}\p{N}_]+/gu)||[]).length,5);
 assert.ok(out.includes('#薬剤師')); assert.ok(!out.includes('#六個目')); assert.ok(!out.includes('**')); assert.ok(!out.includes('###'));
 for (const s of instagramSections) assert.ok(out.includes(`【${s}】`));
 assert.throws(()=>formatAIText('ただのキャプション','instagram'), /6項目/);
 assert.throws(()=>formatAIText(reel+'\n【画像タイトル】\n重複','instagram'), /重複/);
});
test('Markdownを整形してもハッシュタグや数値は維持する', () => {
 assert.equal(formatAIText('### 見出し\n**朝**のメモ\n#薬剤師\n[資料](https://example.com)\n1.5mg', 'threads'), '見出し\n朝のメモ\n#薬剤師\n資料\n1.5mg');
 for (const invalid of [null,undefined,'',42]) assert.throws(()=>formatAIText(invalid,'room'));
});
test('既存Worker互換のリクエストで指示を送信し、応答を整形する',async()=>{
 let body;
 const result=await requestAI({platform:'instagram',theme:'健康メモ',details:'確認した事実',tone:'polite',token:'TEST_ONLY'}, {fetchImpl:async(url,options)=>{ body=JSON.parse(options.body);return {ok:true,json:async()=>({text:reel})}; }});
 assert.deepEqual(Object.keys(body),['platform','topic','notes']);assert.match(body.notes,/確認した事実/);assert.match(body.notes,/丁寧/);assert.match(result,/【画像タイトル】/);
});
test('認証未入力・HTTP失敗・不正応答・通信失敗を説明する。秘密やサーバー本文を表示しない',async()=>{
 const args={platform:'threads',theme:'朝',token:'TEST_ONLY'};
 await assert.rejects(requestAI({...args,token:''}),/未入力/);
 for (const status of [400,401,403,429,500]) {
  await assert.rejects(requestAI(args,{fetchImpl:async()=>({ok:false,status,json:async()=>({error:'PRIVATE_SERVER_DETAIL'})})}), e=>e.message.includes(String(status))&&!e.message.includes('PRIVATE_SERVER_DETAIL'));
 }
 await assert.rejects(requestAI(args,{fetchImpl:async()=>{throw new TypeError('PRIVATE_DETAIL')}}),/CORS/);
 await assert.rejects(requestAI(args,{fetchImpl:async()=>({ok:true,json:async()=>{throw new Error('PRIVATE_DETAIL')}})}),/応答形式/);
 await assert.rejects(requestAI(args,{fetchImpl:async()=>({ok:true,json:async()=>({})})}),/有効な投稿文/);
});
test('通信が終わらない場合にタイムアウトする',async()=>{
 await assert.rejects(requestAI({platform:'room',theme:'商品',token:'TEST_ONLY'},{timeoutMs:5,fetchImpl:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort'))))}),/タイムアウト/);
});
