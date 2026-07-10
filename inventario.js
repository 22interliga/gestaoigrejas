// ===================================================================
// Sistema de Gestão para Igrejas — inventario.js
// Módulo 5: Inventário (controle de patrimônio)
// ===================================================================

(function () {
  let itemEmEdicaoId = null;

  const viewLista = document.getElementById('view-inventario');
  const viewForm = document.getElementById('view-item-form');
  const lista = document.getElementById('inventario-lista');

  async function abrirLista() {
    viewForm.classList.add('hidden');
    viewLista.classList.remove('hidden');
    await carregarItens();
  }

  async function carregarItens(filtros) {
    lista.innerHTML = '<div class="empty-state"><div class="display">Carregando...</div></div>';
    const igrejaId = window.currentIgrejaId;
    if (!igrejaId) return;

    try {
      const snap = await db.collection('inventario').where('igrejaId', '==', igrejaId).get();
      let itens = [];
      snap.forEach(doc => itens.push({ id: doc.id, ...doc.data() }));

      if (filtros) {
        const norm = s => (s || '').toString().toLowerCase();
        if (filtros.descricao) itens = itens.filter(i => norm(i.descricao).includes(norm(filtros.descricao)) || norm(i.categoria).includes(norm(filtros.descricao)));
        if (filtros.localizacao) itens = itens.filter(i => norm(i.localizacao).includes(norm(filtros.localizacao)));
        if (filtros.responsavel) itens = itens.filter(i => norm(i.responsavel).includes(norm(filtros.responsavel)));
      }

      itens.sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));

      renderLista(itens);
      renderResumo(itens);
      renderGraficoCategorias(itens);
    } catch (err) {
      console.error(err);
      lista.innerHTML = `<div class="empty-state"><div class="display">Erro ao carregar itens</div><div>${escapeHtml(err.message)}</div></div>`;
    }
  }

  function renderLista(itens) {
    if (itens.length === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          <div class="display">Nenhum item cadastrado</div>
          <div>Clique em "+ Novo item" para registrar um bem do patrimônio.</div>
        </div>`;
      return;
    }

    const corEstado = {
      'Novo': 'badge-ativo', 'Bom': 'badge-ativo', 'Regular': 'badge-congregado',
      'Ruim': 'badge-afastado', 'Inservível': 'badge-desligado'
    };

    lista.innerHTML = itens.map(i => `
      <div style="display:flex; align-items:center; gap:14px; padding:12px 4px; border-bottom:1px solid var(--line);">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600;">${escapeHtml(i.descricao || i.categoria || '(sem descrição)')}</div>
          <div style="font-size:0.78rem; color:var(--ink-muted);">
            ${escapeHtml(i.categoria || '—')} ${i.numeroPatrimonio ? '· Nº ' + escapeHtml(i.numeroPatrimonio) : ''} ${i.localizacao ? '· ' + escapeHtml(i.localizacao) : ''} ${i.responsavel ? '· ' + escapeHtml(i.responsavel) : ''}
          </div>
        </div>
        <span class="badge ${corEstado[i.estado] || 'badge-visitante'}">${escapeHtml(i.estado || '—')}</span>
        <div class="display" style="min-width:90px; text-align:right;">R$ ${formatarValor(i.valor)}</div>
        <button class="btn btn-ghost" data-action="editar" data-id="${i.id}" style="padding:6px 10px;">Editar</button>
      </div>
    `).join('');

    lista.querySelectorAll('[data-action="editar"]').forEach(btn => {
      btn.addEventListener('click', () => abrirFormulario(btn.dataset.id, itens));
    });
  }

  function renderResumo(itens) {
    const valorTotal = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    document.getElementById('inv-total-itens').textContent = itens.length;
    document.getElementById('inv-valor-total').textContent = 'R$ ' + formatarValor(valorTotal);
  }

  function renderGraficoCategorias(itens) {
    const container = document.getElementById('inv-grafico-categorias');
    if (itens.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="display">Sem itens cadastrados ainda</div></div>';
      return;
    }
    const porCategoria = {};
    itens.forEach(i => {
      const cat = i.categoria || 'Outros';
      porCategoria[cat] = (porCategoria[cat] || 0) + (Number(i.valor) || 0);
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
            <div style="background:var(--gold-500); height:100%; width:${Math.round((valor / max) * 100)}%;"></div>
          </div>
        </div>
      `).join('');
  }

  // -----------------------------------------------------------------
  // Busca
  // -----------------------------------------------------------------
  document.getElementById('btn-buscar-itens').addEventListener('click', () => {
    carregarItens({
      descricao: document.getElementById('if-nome').value,
      localizacao: document.getElementById('if-localizacao').value,
      responsavel: document.getElementById('if-responsavel').value,
    });
  });
  document.getElementById('btn-limpar-busca-inv').addEventListener('click', () => {
    ['if-nome', 'if-localizacao', 'if-responsavel'].forEach(id => document.getElementById(id).value = '');
    carregarItens();
  });

  // -----------------------------------------------------------------
  // Formulário
  // -----------------------------------------------------------------
  function limparFormulario() {
    itemEmEdicaoId = null;
    document.getElementById('if-categoria').selectedIndex = 0;
    document.getElementById('if-descricao').value = '';
    document.getElementById('if-numero').value = '';
    document.getElementById('if-estado').selectedIndex = 0;
    document.getElementById('if-localizacao-form').value = '';
    document.getElementById('if-responsavel-form').value = '';
    document.getElementById('if-valor').value = '';
    document.getElementById('if-data-aquisicao').value = '';
    document.getElementById('if-observacoes').value = '';
    document.getElementById('item-form-titulo').textContent = 'Novo item';
  }

  function abrirFormulario(id, listaAtual) {
    limparFormulario();
    if (id) {
      const i = listaAtual.find(x => x.id === id);
      if (!i) return;
      itemEmEdicaoId = id;
      document.getElementById('item-form-titulo').textContent = 'Editar item';
      if (i.categoria) document.getElementById('if-categoria').value = i.categoria;
      document.getElementById('if-descricao').value = i.descricao || '';
      document.getElementById('if-numero').value = i.numeroPatrimonio || '';
      if (i.estado) document.getElementById('if-estado').value = i.estado;
      document.getElementById('if-localizacao-form').value = i.localizacao || '';
      document.getElementById('if-responsavel-form').value = i.responsavel || '';
      document.getElementById('if-valor').value = i.valor || '';
      document.getElementById('if-data-aquisicao').value = i.dataAquisicao || '';
      document.getElementById('if-observacoes').value = i.observacoes || '';
    }
    viewLista.classList.add('hidden');
    viewForm.classList.remove('hidden');
  }

  document.getElementById('btn-novo-item').addEventListener('click', () => abrirFormulario(null));
  document.getElementById('btn-cancelar-item').addEventListener('click', () => abrirLista());
  document.getElementById('btn-cancelar-item-2').addEventListener('click', () => abrirLista());

  document.getElementById('btn-salvar-item').addEventListener('click', async () => {
    const descricao = document.getElementById('if-descricao').value.trim();
    if (!descricao) {
      alert('A descrição do item é obrigatória.');
      return;
    }

    const dados = {
      igrejaId: window.currentIgrejaId,
      categoria: document.getElementById('if-categoria').value,
      descricao,
      numeroPatrimonio: document.getElementById('if-numero').value.trim(),
      estado: document.getElementById('if-estado').value,
      localizacao: document.getElementById('if-localizacao-form').value.trim(),
      responsavel: document.getElementById('if-responsavel-form').value.trim(),
      valor: parseFloat(document.getElementById('if-valor').value) || 0,
      dataAquisicao: document.getElementById('if-data-aquisicao').value,
      observacoes: document.getElementById('if-observacoes').value.trim(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      if (itemEmEdicaoId) {
        await db.collection('inventario').doc(itemEmEdicaoId).update(dados);
      } else {
        dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('inventario').add(dados);
      }
      await abrirLista();
    } catch (err) {
      alert('Erro ao salvar item: ' + err.message);
    }
  });

  // -----------------------------------------------------------------
  // Utilitários
  // -----------------------------------------------------------------
  function formatarValor(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  window.InventarioModule = { abrirLista };
})();
