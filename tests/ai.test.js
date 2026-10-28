import test from 'node:test';
import assert from 'node:assert/strict';
import { generationNotes, formatAIText, requestAI, instagramSections, plainText, draftLengthHint } from '../generator.js';
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
 assert.equal(formatAIText('### 見出し\n**朝**のメモ\n#薬剤師\n[資料](https://example.com)\n1.5mg', 'threads'), '見出し\n朝のメモ\n#薬剤師\n資料（https://example.com）\n1.5mg');
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
test('管理薬剤師・腸活の根拠と未確認情報を区別し、媒体の具体性を指示する',()=>{
 const common=generationNotes({platform:'instagram'});
 for (const rule of ['現役管理薬剤師','腸活','菌種・菌株','確認済み','参照できていない','個別の診断','約9秒','一つの要点']) assert.ok(common.includes(rule),rule);
 assert.match(generationNotes({platform:'threads'}),/毎回同じ定型の質問/);
 assert.match(generationNotes({platform:'room'}),/どんな場面・用途に便利か/);
 assert.match(generationNotes({platform:'room'}),/使用経験が明記されていなければ/);
});
test('引用・区切り線・リスト等を除去し、用量・負数・比較・URLを保つ',()=>{
 const input='> **確認メモ**\n1. _確認_\n---\n___\n- 1.5mg\n-5℃\n> 5mg\nhttps://example.com/a_b?q=x_y#section\n[添付文書](https://example.com/doc_(v1)#dose)';
 assert.equal(plainText(input),'確認メモ\n確認\n\n\n1.5mg\n-5℃\n> 5mg\nhttps://example.com/a_b?q=x_y#section\n添付文書（https://example.com/doc_(v1)#dose）');
 assert.equal(plainText('\\*\\*装飾\\*\\*'),'装飾');
});
test('Instagramは整形後の空欄も拒否し、出典URLのフラグメントを残す',()=>{
 assert.throws(()=>formatAIText(reel.replace('**説明**','#健康'),'instagram'),/整形後に空/);
 const result=formatAIText(reel.replace('**説明**','[資料](https://example.com/guide#health)'),'instagram');
 assert.ok(result.includes('https://example.com/guide#health'));
});
test('Instagramの文字数はキャプションとタグを分け、他項目や見出しを数えない',()=>{
 const text=instagramSections.map(s=>`【${s}】\n${s==='投稿キャプション'?'短文':s==='ハッシュタグ'?'なし':'あ'.repeat(2300)}`).join('\n\n');
 const hint=draftLengthHint(text,'instagram');
 assert.match(hint,/キャプション＋ハッシュタグ 2文字/);assert.ok(!hint.includes('超えています'));
 assert.match(draftLengthHint(text.replace('短文','あ'.repeat(2201)),'instagram'),/超えています/);
 assert.match(draftLengthHint('従来保存した単一の投稿文','instagram'),/判定できません/);
});
test('コピー用Worker指示はアプリの共通・媒体別ルールと一致する',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {commonGenerationRules,platformGenerationRules}=await import('../generator.js');
 const prompt=await readFile(new URL('../WORKER_SYSTEM_PROMPT.txt',import.meta.url),'utf8');
 for(const rule of [commonGenerationRules,...Object.values(platformGenerationRules)])assert.ok(prompt.includes(rule));
 assert.match(prompt,/system|固定指示/);
});
