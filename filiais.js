// ===================================================================
// Sistema de Gestão para Igrejas — filiais.js
// Módulo 3: Filiais (cadastro e comparativo entre unidades)
// ===================================================================

(function () {
  let filialEmEdicaoId = null;

  const viewFiliais = document.getElementById('view-filiais');
  const viewForm = document.getElementById('view-filial-form');
  const lista = document.getElementById('filiais-lista');
  const comparativo = document.getElementById('filiais-comparativo');

  async function abrirLista() {
    viewForm.classList.add('hidden');
    viewFiliais.classList.remove('hidden');
    await carregarFiliais();
  }

  async function carregarFiliais() {
    lista.innerHTML = '<div class="empty-state"><div class="display">Carregando...</div></div>';
    comparativo.innerHTML = '';
    const igrejaId = window.currentIgrejaId;
    if (!igrejaId) return;

    try {
      const [filiaisSnap, membrosSnap] = await Promise.all([
        db.collection('filiais').where('igrejaId', '==', igrejaId).get(),
        db.collection('membros').where('igrejaId', '==', igrejaId).get()
      ]);

      const filiais = [];
      filiaisSnap.forEach(doc => filiais.push({ id: doc.id, ...doc.data() }));
      filiais.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

      // Conta membros por filial (comparando pelo nome, já que membros.js
      // guarda o nome da filial em texto livre, não um ID)
      const contagem = {};
      membrosSnap.forEach(doc => {
        const nomeFilial = (doc.data().filial || 'Sede').trim();
        contagem[nomeFilial] = (contagem[nomeFilial] || 0) + 1;
      });

      renderLista(filiais, contagem);
      renderComparativo(filiais, contagem);
    } catch (err) {
      console.error(err);
      lista.innerHTML = `<div class="empty-state"><div class="display">Erro ao carregar filiais</div><div>${escapeHtml(err.message)}</div></div>`;
    }
  }

  function renderLista(filiais, contagem) {
    if (filiais.length === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          <div class="display">Nenhuma filial cadastrada</div>
          <div>Cadastre a primeira clicando em "+ Nova filial". A sede não precisa ser cadastrada aqui — ela é a igreja principal.</div>
        </div>`;
      return;
    }

    lista.innerHTML = filiais.map(f => `
      <div style="display:flex; align-items:center; gap:14px; padding:14px 4px; border-bottom:1px solid var(--line);">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600;">${escapeHtml(f.nome || '(sem nome)')}</div>
          <div style="font-size:0.78rem; color:var(--ink-muted);">
            ${escapeHtml(f.pastor || 'Sem pastor definido')} ${f.cidade ? '· ' + escapeHtml(f.cidade) + (f.estado ? '/' + escapeHtml(f.estado) : '') : ''}
          </div>
        </div>
        <div style="text-align:center; min-width:70px;">
          <div class="display" style="font-size:1.2rem; color:var(--ink-900);">${contagem[f.nome] || 0}</div>
          <div style="font-size:0.68rem; color:var(--ink-muted); text-transform:uppercase;">membros</div>
        </div>
        <button class="btn btn-ghost" data-action="editar" data-id="${f.id}" style="padding:6px 10px;">Editar</button>
      </div>
    `).join('');

    lista.querySelectorAll('[data-action="editar"]').forEach(btn => {
      btn.addEventListener('click', () => abrirFormulario(btn.dataset.id, filiais));
    });
  }

  function renderComparativo(filiais, contagem) {
    // Inclui a Sede no comparativo mesmo sem documento próprio em /filiais
    const nomesSede = contagem['Sede'] ? [{ nome: 'Sede', ehSede: true }] : [];
    const todas = [...nomesSede, ...filiais];

    if (todas.length === 0) {
      comparativo.innerHTML = '<div class="empty-state"><div class="display">Sem dados suficientes ainda</div></div>';
      return;
    }

    const maxMembros = Math.max(1, ...todas.map(f => contagem[f.nome] || 0));

    comparativo.innerHTML = todas.map(f => {
      const qtd = contagem[f.nome] || 0;
      const pct = Math.round((qtd / maxMembros) * 100);
      return `
        <div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
            <span>${escapeHtml(f.nome)}${f.ehSede ? ' <span class="badge badge-congregado" style="margin-left:6px;">Sede</span>' : ''}</span>
            <span style="color:var(--ink-muted);">${qtd} membro${qtd === 1 ? '' : 's'}</span>
          </div>
          <div style="background:var(--cream-200); border-radius:999px; height:8px; overflow:hidden;">
            <div style="background:var(--gold-500); height:100%; width:${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // -----------------------------------------------------------------
  // Formulário
  // -----------------------------------------------------------------
  const campos = ['nome', 'pastor', 'endereco', 'cidade', 'estado', 'telefone', 'whatsapp', 'tesoureiro', 'secretario'];

  function limparFormulario() {
    filialEmEdicaoId = null;
    campos.forEach(c => {
      const el = document.getElementById('fl-' + c);
      if (el) el.value = '';
    });
    document.getElementById('filial-form-titulo').textContent = 'Nova filial';
  }

  function abrirFormulario(id, listaAtual) {
    limparFormulario();
    if (id) {
      const f = listaAtual.find(x => x.id === id);
      if (!f) return;
      filialEmEdicaoId = id;
      document.getElementById('filial-form-titulo').textContent = 'Editar filial';
      campos.forEach(c => {
        const el = document.getElementById('fl-' + c);
        if (el && f[c] !== undefined && f[c] !== null) el.value = f[c];
      });
    }
    viewFiliais.classList.add('hidden');
    viewForm.classList.remove('hidden');
  }

  document.getElementById('btn-nova-filial').addEventListener('click', () => abrirFormulario(null));
  document.getElementById('btn-cancelar-filial').addEventListener('click', () => abrirLista());
  document.getElementById('btn-cancelar-filial-2').addEventListener('click', () => abrirLista());

  document.getElementById('btn-salvar-filial').addEventListener('click', async () => {
    const nome = document.getElementById('fl-nome').value.trim();
    if (!nome) {
      alert('O nome da filial é obrigatório.');
      return;
    }

    const dados = {
      igrejaId: window.currentIgrejaId,
      nome,
      pastor: document.getElementById('fl-pastor').value.trim(),
      endereco: document.getElementById('fl-endereco').value.trim(),
      cidade: document.getElementById('fl-cidade').value.trim(),
      estado: document.getElementById('fl-estado').value.trim(),
      telefone: document.getElementById('fl-telefone').value.trim(),
      whatsapp: document.getElementById('fl-whatsapp').value.trim(),
      tesoureiro: document.getElementById('fl-tesoureiro').value.trim(),
      secretario: document.getElementById('fl-secretario').value.trim(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      if (filialEmEdicaoId) {
        await db.collection('filiais').doc(filialEmEdicaoId).update(dados);
      } else {
        dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('filiais').add(dados);
      }
      await abrirLista();
    } catch (err) {
      alert('Erro ao salvar filial: ' + err.message);
    }
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  window.FiliaisModule = { abrirLista };
})();
