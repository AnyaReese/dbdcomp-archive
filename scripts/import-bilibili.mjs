import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('用法: npm run import:bilibili -- <文章 cv 数字 ID> [...]');
  process.exit(1);
}

const root = process.cwd();
const dataFile = path.join(root, 'src/data/issues.json');
const imageRoot = path.join(root, 'public/images/issues');
await mkdir(path.dirname(dataFile), { recursive: true });
await mkdir(imageRoot, { recursive: true });

let issues = [];
try { issues = JSON.parse(await readFile(dataFile, 'utf8')); } catch {}

const headers = {
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://www.bilibili.com/',
};

async function fetchArticle(id) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.bilibili.com/x/article/view?id=${id}`, { headers });
    const payload = await response.json();
    if (payload.code === 0) return payload.data;
    if (payload.code !== -509 || attempt === 3) throw new Error(`Bilibili ${id}: ${payload.message}`);
    await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
  }
}

const textFromNodes = (nodes = []) => nodes.map((node) => {
  if (node.word) return { type: 'text', text: node.word.words, bold: Boolean(node.word.style?.bold) };
  if (node.link) return { type: 'link', text: node.link.show_text, href: node.link.link };
  return null;
}).filter(Boolean);

for (const id of ids) {
  const article = await fetchArticle(id);
  const volume = Number(article.title.match(/vol\.\s*(\d+)/i)?.[1] ?? 0);
  const baseSlug = `vol-${volume || id}`;
  const duplicateVolume = issues.some((item) => item.volume === volume && item.id !== article.id);
  const slug = duplicateVolume ? `${baseSlug}-${article.id}` : baseSlug;
  const blocks = [];
  let imageIndex = 0;

  for (const paragraph of article.opus?.content?.paragraphs ?? []) {
    if (paragraph.pic?.pics?.length) {
      for (const picture of paragraph.pic.pics) {
        imageIndex += 1;
        const remote = picture.url.replace(/^http:/, 'https:');
        const extension = path.extname(new URL(remote).pathname) || '.jpg';
        const filename = `${String(imageIndex).padStart(2, '0')}${extension}`;
        const folder = path.join(imageRoot, slug);
        await mkdir(folder, { recursive: true });
        const image = await fetch(remote, { headers });
        if (!image.ok) throw new Error(`图片下载失败: ${remote}`);
        await writeFile(path.join(folder, filename), Buffer.from(await image.arrayBuffer()));
        blocks.push({ type: 'image', src: `/images/issues/${slug}/${filename}`, alt: picture.comment || article.title });
      }
      continue;
    }

    const nodes = textFromNodes(paragraph.text?.nodes);
    if (!nodes.length) continue;
    const heading = paragraph.format?.heading_type;
    blocks.push({ type: heading ? 'heading' : 'paragraph', level: heading ? Math.min(heading + 1, 4) : undefined, nodes });
  }

  const date = new Date(article.publish_time * 1000).toISOString();
  const issue = {
    id: article.id,
    slug,
    volume,
    title: article.title,
    summary: article.summary,
    publishedAt: date,
    author: article.author?.name || '奥奥猫与拖把狗',
    sourceUrl: `https://www.bilibili.com/read/cv${article.id}/`,
    // dyn_id_str must stay a string: dynamic IDs exceed JavaScript's safe integer range.
    dynamicUrl: `https://t.bilibili.com/${article.dyn_id_str || String(article.opus?.opus_id)}`,
    cover: `/images/issues/${slug}/01${path.extname(new URL((article.opus?.content?.paragraphs ?? []).find(p => p.pic)?.pic?.pics?.[0]?.url || article.image_urls?.[0]).pathname) || '.jpg'}`,
    blocks,
  };

  issues = issues.filter((item) => item.id !== issue.id);
  issues.push(issue);
  issues.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  // Persist after every article so a later rate limit never loses completed work.
  await writeFile(dataFile, `${JSON.stringify(issues, null, 2)}\n`);
  await new Promise((resolve) => setTimeout(resolve, 4500));
}

await writeFile(dataFile, `${JSON.stringify(issues, null, 2)}\n`);
console.log(`已整理 ${ids.length} 篇文章，共 ${issues.length} 期。`);
