// ===================================================================
// Sistema de Gestão para Igrejas — diretoria.js
// Módulo 7: Diretoria (quadro de liderança)
// ===================================================================

(function () {
  let itemEmEdicaoId = null;

  // Ordem de exibição — segue a hierarquia comum em igrejas
  const ORDEM_CARGOS = [
    'Pastor Presidente', 'Vice-Presidente', 'Secretário', 'Segundo Secretário',
    'Tesoureiro', 'Segundo Tesoureiro', 'Conselho', 'Presbítero', 'Diácono',
    'Evangelista', 'Missionário', 'Líder de departamento'
  ];

  const viewLista = document.getElementById('view-diretoria');
  const viewForm = document.getElementById('view-diretoria-form');
  const lista = document.getElementById('diretoria-lista');

  async function abrirLista() {
    viewForm.classList.add('hidden');
    viewLista.classList.remove('hidden');
    await carregarDiretoria();
  }

  async function carregarDiretoria() {
    lista.innerHTML = '<div class="empty-state"><div class="display">Carregando...</div></div>';
    const igrejaId = window.currentIgrejaId;
    if (!igrejaId) return;

    try {
      const snap = await db.collection('diretoria').where('igrejaId', '==', igrejaId).get();
      let itens = [];
      snap.forEach(doc => itens.push({ id: doc.id, ...doc.data() }));

      itens.sort((a, b) => {
        const ia = ORDEM_CARGOS.indexOf(a.cargo);
        const ib = ORDEM_CARGOS.indexOf(b.cargo);
        if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return (a.nome || '').localeCompare(b.nome || '');
      });

      renderLista(itens);
    } catch (err) {
      console.error(err);
      lista.innerHTML = `<div class="empty-state"><div class="display">Erro ao carregar a diretoria</div><div>${escapeHtml(err.message)}</div></div>`;
    }
  }

  function renderLista(itens) {
    if (itens.length === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          <div class="display">Nenhum membro da diretoria cadastrado</div>
          <div>Clique em "+ Novo membro da diretoria" pra começar.</div>
        </div>`;
      return;
    }

    // Agrupa por cargo pra ficar mais fácil de visualizar o quadro
    const grupos = {};
    itens.forEach(i => {
      const c = i.cargo || 'Outros';
      if (!grupos[c]) grupos[c] = [];
      grupos[c].push(i);
    });

    lista.innerHTML = Object.entries(grupos).map(([cargo, pessoas]) => `
      <div style="margin-bottom:18px;">
        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--gold-600); font-weight:600; margin-bottom:6px;">
          ${escapeHtml(cargo)}
        </div>
        ${pessoas.map(p => `
          <div style="display:flex; align-items:center; gap:14px; padding:10px 4px; border-bottom:1px solid var(--line);">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600;">${escapeHtml(p.nome || '(sem nome)')}</div>
              <div style="font-size:0.78rem; color:var(--ink-muted);">
                ${escapeHtml(p.telefone || '—')} ${p.email ? '· ' + escapeHtml(p.email) : ''}
              </div>
            </div>
            <button class="btn btn-ghost" data-action="editar" data-id="${p.id}" style="padding:6px 10px;">Editar</button>
          </div>
        `).join('')}
      </div>
    `).join('');

    lista.querySelectorAll('[data-action="editar"]').forEach(btn => {
      btn.addEventListener('click', () => abrirFormulario(btn.dataset.id, itens));
    });
  }

  // -----------------------------------------------------------------
  // Formulário
  // -----------------------------------------------------------------
  function limparFormulario() {
    itemEmEdicaoId = null;
    document.getElementById('dr-cargo').selectedIndex = 0;
    document.getElementById('dr-nome').value = '';
    document.getElementById('dr-telefone').value = '';
    document.getElementById('dr-email').value = '';
    document.getElementById('dr-observacoes').value = '';
    document.getElementById('diretoria-form-titulo').textContent = 'Novo membro da diretoria';
  }

  function abrirFormulario(id, listaAtual) {
    limparFormulario();
    if (id) {
      const p = listaAtual.find(x => x.id === id);
      if (!p) return;
      itemEmEdicaoId = id;
      document.getElementById('diretoria-form-titulo').textContent = 'Editar membro da diretoria';
      if (p.cargo) document.getElementById('dr-cargo').value = p.cargo;
      document.getElementById('dr-nome').value = p.nome || '';
      document.getElementById('dr-telefone').value = p.telefone || '';
      document.getElementById('dr-email').value = p.email || '';
      document.getElementById('dr-observacoes').value = p.observacoes || '';
    }
    viewLista.classList.add('hidden');
    viewForm.classList.remove('hidden');
  }

  document.getElementById('btn-novo-cargo').addEventListener('click', () => abrirFormulario(null));
  document.getElementById('btn-cancelar-diretoria').addEventListener('click', () => abrirLista());
  document.getElementById('btn-cancelar-diretoria-2').addEventListener('click', () => abrirLista());

  document.getElementById('btn-salvar-diretoria').addEventListener('click', async () => {
    const nome = document.getElementById('dr-nome').value.trim();
    if (!nome) {
      alert('O nome é obrigatório.');
      return;
    }

    const dados = {
      igrejaId: window.currentIgrejaId,
      cargo: document.getElementById('dr-cargo').value,
      nome,
      telefone: document.getElementById('dr-telefone').value.trim(),
      email: document.getElementById('dr-email').value.trim(),
      observacoes: document.getElementById('dr-observacoes').value.trim(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      if (itemEmEdicaoId) {
        await db.collection('diretoria').doc(itemEmEdicaoId).update(dados);
      } else {
        dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('diretoria').add(dados);
      }
      await abrirLista();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  window.DiretoriaModule = { abrirLista };
})();
