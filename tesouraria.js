// ===================================================================
// Sistema de Gestão para Igrejas — tesouraria.js
// Módulo 4: Tesouraria (entradas, saídas, fluxo de caixa)
// ===================================================================

(function () {
  const CATEGORIAS_ENTRADA = ['Dízimos', 'Ofertas', 'Missões', 'Campanhas', 'Doações', 'Eventos', 'Outros'];
  const CATEGORIAS_SAIDA = ['Água', 'Energia', 'Internet', 'Salários', 'Ajudas', 'Compras', 'Construção', 'Manutenção', 'Outros'];

  const viewLista = document.getElementById('view-tesouraria');
  const viewForm = document.getElementById('view-lancamento-form');
  const lista = document.getElementById('tesouraria-lista');
  const filtroMes = document.getElementById('tes-filtro-mes');

  function mesAtualISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  async function abrirLista() {
    viewForm.classList.add('hidden');
    viewLista.classList.remove('hidden');
    if (!filtroMes.value) filtroMes.value = mesAtualISO();
    await carregarLancamentos();
  }

  filtroMes.addEventListener('change', carregarLancamentos);

  async function carregarLancamentos() {
    lista.innerHTML = '<div class="empty-state"><div class="display">Carregando...</div></div>';
    const igrejaId = window.currentIgrejaId;
    if (!igrejaId) return;

    try {
      const snap = await db.collection('financeiro').where('igrejaId', '==', igrejaId).get();
      let lancamentos = [];
      snap.forEach(doc => lancamentos.push({ id: doc.id, ...doc.data() }));

      const mesFiltro = filtroMes.value || mesAtualISO();
      lancamentos = lancamentos.filter(l => (l.data || '').startsWith(mesFiltro));
      lancamentos.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

      renderLista(lancamentos);
      renderResumo(lancamentos);
      renderGraficos(lancamentos);
    } catch (err) {
      console.error(err);
      lista.innerHTML = `<div class="empty-state"><div class="display">Erro ao carregar lançamentos</div><div>${escapeHtml(err.message)}</div></div>`;
    }
  }

  function renderLista(lancamentos) {
    if (lancamentos.length === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          <div class="display">Nenhum lançamento neste mês</div>
          <div>Clique em "+ Novo lançamento" para registrar uma entrada ou saída.</div>
        </div>`;
      return;
    }

    lista.innerHTML = lancamentos.map(l => {
      const cor = l.tipo === 'entrada' ? 'var(--ok-600)' : 'var(--warn-600)';
      const sinal = l.tipo === 'entrada' ? '+' : '−';
      return `
        <div style="display:flex; align-items:center; gap:14px; padding:12px 4px; border-bottom:1px solid var(--line);">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600;">${escapeHtml(l.categoria || '—')}</div>
            <div style="font-size:0.78rem; color:var(--ink-muted);">
              ${formatarData(l.data)} ${l.filial ? '· ' + escapeHtml(l.filial) : ''} ${l.descricao ? '· ' + escapeHtml(l.descricao) : ''}
            </div>
          </div>
          <div class="display" style="color:${cor}; font-size:1.1rem;">${sinal} R$ ${formatarValor(l.valor)}</div>
        </div>
      `;
    }).join('');
  }

  function renderResumo(lancamentos) {
    const totalEntradas = lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const totalSaidas = lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const saldo = totalEntradas - totalSaidas;

    document.getElementById('tes-total-entradas').textContent = 'R$ ' + formatarValor(totalEntradas);
    document.getElementById('tes-total-saidas').textContent = 'R$ ' + formatarValor(totalSaidas);
    const saldoEl = document.getElementById('tes-saldo');
    saldoEl.textContent = 'R$ ' + formatarValor(saldo);
    saldoEl.style.color = saldo >= 0 ? 'var(--ok-600)' : 'var(--warn-600)';
  }

  function renderGraficos(lancamentos) {
    renderGraficoPorCategoria(
      lancamentos.filter(l => l.tipo === 'entrada'),
      document.getElementById('tes-grafico-entradas'),
      'var(--ok-600)'
    );
    renderGraficoPorCategoria(
      lancamentos.filter(l => l.tipo === 'saida'),
      document.getElementById('tes-grafico-saidas'),
      'var(--warn-600)'
    );
  }

  function renderGraficoPorCategoria(lancamentos, container, cor) {
    if (lancamentos.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="display">Sem dados neste mês</div></div>';
      return;
    }
    const porCategoria = {};
    lancamentos.forEach(l => {
      const cat = l.categoria || 'Outros';
      porCategoria[cat] = (porCategoria[cat] || 0) + (Number(l.valor) || 0);
    });
    const max = Math.max(...Object.values(porCategoria));

    container.innerHTML = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, valor]) => `
        <div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
            <span>${escapeHtml(cat)}</span>
            <span style="color:var(--ink-muted);">R$ ${formatarValor(valor)}</span>
          </div>
          <div style="background:var(--cream-200); border-radius:999px; height:8px; overflow:hidden;">
            <div style="background:${cor}; height:100%; width:${Math.round((valor / max) * 100)}%;"></div>
          </div>
        </div>
      `).join('');
  }

  // -----------------------------------------------------------------
  // Resumo financeiro no dashboard principal
  // -----------------------------------------------------------------
  async function atualizarPainelDashboard(igrejaId) {
    const painel = document.getElementById('fin-empty');
    if (!painel || !igrejaId) return;

    try {
      const snap = await db.collection('financeiro').where('igrejaId', '==', igrejaId).get();
      const mes = mesAtualISO();
      let lancamentos = [];
      snap.forEach(doc => lancamentos.push(doc.data()));
      lancamentos = lancamentos.filter(l => (l.data || '').startsWith(mes));

      if (lancamentos.length === 0) return; // mantém o empty-state padrão

      const totalEntradas = lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + (Number(l.valor) || 0), 0);
      const totalSaidas = lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + (Number(l.valor) || 0), 0);
      const saldo = totalEntradas - totalSaidas;

      painel.outerHTML = `
        <div id="fin-empty">
          <div class="field-row" style="grid-template-columns: repeat(3,1fr); gap:12px;">
            <div><div style="font-size:0.72rem; color:var(--ink-muted); text-transform:uppercase;">Entradas</div>
              <div class="display" style="color:var(--ok-600); font-size:1.3rem;">R$ ${formatarValor(totalEntradas)}</div></div>
            <div><div style="font-size:0.72rem; color:var(--ink-muted); text-transform:uppercase;">Saídas</div>
              <div class="display" style="color:var(--warn-600); font-size:1.3rem;">R$ ${formatarValor(totalSaidas)}</div></div>
            <div><div style="font-size:0.72rem; color:var(--ink-muted); text-transform:uppercase;">Saldo</div>
              <div class="display" style="color:${saldo >= 0 ? 'var(--ok-600)' : 'var(--warn-600)'}; font-size:1.3rem;">R$ ${formatarValor(saldo)}</div></div>
          </div>
        </div>`;
    } catch (err) {
      console.warn('Resumo financeiro ainda não disponível:', err.message);
    }
  }

  // -----------------------------------------------------------------
  // Formulário
  // -----------------------------------------------------------------
  const tipoSelect = document.getElementById('tl-tipo');
  const categoriaSelect = document.getElementById('tl-categoria');

  function popularCategorias() {
    const opcoes = tipoSelect.value === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
    categoriaSelect.innerHTML = opcoes.map(c => `<option value="${c}">${c}</option>`).join('');
  }
  tipoSelect.addEventListener('change', popularCategorias);

  function abrirFormulario() {
    tipoSelect.value = 'entrada';
    popularCategorias();
    document.getElementById('tl-valor').value = '';
    document.getElementById('tl-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('tl-filial').value = '';
    document.getElementById('tl-descricao').value = '';
    viewLista.classList.add('hidden');
    viewForm.classList.remove('hidden');
  }

  document.getElementById('btn-novo-lancamento').addEventListener('click', abrirFormulario);
  document.getElementById('btn-cancelar-lancamento').addEventListener('click', () => abrirLista());
  document.getElementById('btn-cancelar-lancamento-2').addEventListener('click', () => abrirLista());

  document.getElementById('btn-salvar-lancamento').addEventListener('click', async () => {
    const valor = parseFloat(document.getElementById('tl-valor').value);
    const data = document.getElementById('tl-data').value;
    if (!valor || valor <= 0 || !data) {
      alert('Informe um valor válido e a data do lançamento.');
      return;
    }

    const dados = {
      igrejaId: window.currentIgrejaId,
      tipo: tipoSelect.value,
      categoria: categoriaSelect.value,
      valor,
      data,
      filial: document.getElementById('tl-filial').value.trim(),
      descricao: document.getElementById('tl-descricao').value.trim(),
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await db.collection('financeiro').add(dados);
      await abrirLista();
      await atualizarPainelDashboard(window.currentIgrejaId);
    } catch (err) {
      alert('Erro ao salvar lançamento: ' + err.message);
    }
  });

  // -----------------------------------------------------------------
  // Utilitários
  // -----------------------------------------------------------------
  function formatarValor(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatarData(iso) {
    if (!iso) return '';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  window.TesourariaModule = { abrirLista, atualizarPainelDashboard };
})();
