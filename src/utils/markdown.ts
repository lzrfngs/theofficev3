export function renderMarkdown(text: string) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.*?)$/gm, '<h4 class="text-md font-semibold mt-3 mb-1 text-slate-100">$1</h4>');
  html = html.replace(/^## (.*?)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-slate-100">$1</h3>');
  html = html.replace(/^# (.*?)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2 text-slate-100">$1</h2>');
  html = html.replace(/^&gt; (.*?)$/gm, '<blockquote class="border-l-4 border-slate-500 pl-3 my-2 text-slate-400 italic bg-slate-900/50 py-1 pr-2 rounded-r">$1</blockquote>');
  html = html.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre class="bg-slate-950 p-3 rounded-lg overflow-x-auto my-2 border border-slate-800 font-mono text-xs text-emerald-400"><code class="language-$1">$2</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code class="bg-slate-900 px-1 py-0.5 rounded text-rose-400 font-mono text-xs">$1</code>');

  if (html.includes('|')) {
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '<div class="overflow-x-auto my-3"><table class="min-w-full divide-y divide-slate-800 border border-slate-800 text-xs text-left">';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml += '<tbody class="divide-y divide-slate-800 bg-slate-900/20">';
        }

        if (line.includes('---')) continue;

        const cells = line.split('|').filter(cell => cell.length > 0);
        tableHtml += '<tr class="hover:bg-slate-800/30">';
        cells.forEach((cell) => {
          tableHtml += `<td class="px-3 py-2 text-slate-300 font-normal border-r border-slate-800 last:border-0">${cell.trim()}</td>`;
        });
        tableHtml += '</tr>';
      } else if (inTable) {
        inTable = false;
        tableHtml += '</tbody></table></div>';
        lines[i] = `${tableHtml}\n${lines[i]}`;
      }
    }

    if (inTable) {
      tableHtml += '</tbody></table></div>';
      html = lines.map((line, index) => index === lines.length - 1 ? tableHtml : line).join('\n');
    } else {
      html = lines.join('\n');
    }
  }

  html = html.replace(/^\* (.*?)$/gm, '<li class="ml-4 list-disc text-slate-300">$1</li>');
  html = html.replace(/^- (.*?)$/gm, '<li class="ml-4 list-disc text-slate-300">$1</li>');

  const paras = html.split(/\n\n+/);
  return paras.map(para => {
    const trimmed = para.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<li') || trimmed.startsWith('<div')) {
      return trimmed;
    }
    return `<p class="mb-2 text-slate-300">${trimmed.replace(/\n/g, '<br/>')}</p>`;
  }).join('');
}
