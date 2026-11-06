import { api, esc, reveal } from '/js/common.js';

const list = document.getElementById('faqs');
try {
  const faqs = await api('/api/faqs');
  list.innerHTML = faqs.length
    ? faqs.map((f, i) => `
      <details data-reveal style="--delay: ${Math.min(i, 6) * 0.05}s" ${i === 0 ? 'open' : ''}>
        <summary>${esc(f.question)}</summary>
        <div class="answer">${esc(f.answer)}</div>
      </details>`).join('')
    : '<p class="muted" style="text-align: center;">No questions here yet. <a href="/contact">Ask us anything!</a></p>';
  reveal(list);
} catch (err) {
  list.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
}
