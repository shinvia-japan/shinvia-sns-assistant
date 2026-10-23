export const platforms = { instagram: 'Instagram', threads: 'Threads', room: '楽天ROOM' };
export function generate({ theme, details = '', platform, tone = 'friendly', variant = 0 }) {
  theme = theme.trim(); details = details.trim();
  if (!theme) throw new Error('投稿テーマを入力してください。');
  if (!platforms[platform]) throw new Error('投稿先を選んでください。');
  const intro = tone === 'polite' ? ['今回は「', '本日は「'] : ['今日のテーマは「', 'ちょっと気になる「'];
  const title = `${intro[variant % 2]}${theme}」${tone === 'polite' ? 'です。' : 'です ✨'}`;
  const body = details || '【ここに、あなたの感想や伝えたいポイントを追加してください】';
  const tag = theme.replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 30);
  if (platform === 'instagram') return `${title}\n\n${body}\n\n${tone === 'polite' ? '皆さんのご感想も、ぜひコメントでお聞かせください。' : 'みなさんはどう思いますか？ コメントで教えてください 💬'}\n\n#Shinvia${tag ? ` #${tag}` : ''} #暮らしのアイデア`;
  if (platform === 'threads') return `${title}\n\n${body}\n\n${variant % 2 ? 'あなたのアイデアも聞かせてください。' : '同じことが気になっている方はいますか？'}`;
  return `${theme}｜気になるアイテムメモ\n\n${body}\n\n購入前に、商品ページで価格・仕様・在庫をご確認ください。\n\n#楽天ROOM #気になるアイテム${tag ? ` #${tag}` : ''}`;
}
export function readPosts(raw) {
  try {
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data.filter(p => p && typeof p.id === 'string' && typeof p.theme === 'string' && typeof p.text === 'string' && platforms[p.platform] && typeof p.date === 'string') : [];
  } catch { return []; }
}
