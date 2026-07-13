// ===================================================================
// Sistema de Gestão para Igrejas — agenda.js
// Módulo 8: Agenda (eventos, cultos, batismos, etc.)
// ===================================================================
//
// Sobre "lembretes automáticos": como o sistema roda inteiramente no
// navegador (sem servidor próprio rodando 24h), não é possível disparar
// notificações push ou WhatsApp sozinho em segundo plano. O que este
// módulo faz é destacar os eventos mais próximos no dashboard sempre
// que alguém abrir o sistema — funciona como lembrete visual, não como
// notificação automática enviada para o celular das pessoas.
// ===================================================================

(function () {
  let eventoEmEdicaoId = null;

  const viewLista = document.getElementById('view-agenda');
  const viewForm = document.getElementById('view-evento-form');
  const lista = document.getElementById('agenda-lista');
  const filtroMes = document.getElementById('ag-filtro-mes');

  function mesAtualISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  async function abrirLista() {
    viewForm.classList.add('hidden');
    viewLista.classList.remove('hidden');
    if (!filtroMes.value) filtroMes.value = mesAtualISO();
    await carregarEventos();
  }

  filtroMes.addEventListener('change', carregarEventos);

  async function carregarEventos() {
    lista.innerHTML = '<div class="empty-state"><div class="display">Carregando...</div></div>';
    const igrejaId = window.currentIgrejaId;
    if (!igrejaId) return;

    try {
      const snap = await db.collection('agenda').where('igrejaId', '==', igrejaId).get();
      let eventos = [];
      snap.forEach(doc => eventos.push({ id: doc.id, ...doc.data() }));

      const mesFiltro = filtroMes.value || mesAtualISO();
      eventos = eventos.filter(e => (e.data || '').startsWith(mesFiltro));
      eventos.sort((a, b) => (a.data + (a.horario || '')).localeCompare(b.data + (b.horario || '')));

      renderLista(eventos);
    } catch (err) {
      console.error(err);
      lista.innerHTML = `<div class="empty-state"><div class="display">Erro ao carregar a agenda</div><div>${escapeHtml(err.message)}</div></div>`;
    }
  }

  function renderLista(eventos) {
    if (eventos.length === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          <div class="display">Nenhum evento neste mês</div>
          <div>Clique em "+ Novo evento" para adicionar um culto, batismo, reunião etc.</div>
        </div>`;
      return;
    }

    const hojeISO = new Date().toISOString().slice(0, 10);

    lista.innerHTML = eventos.map(e => {
      const passado = e.data < hojeISO;
      return `
        <div style="display:flex; align-items:center; gap:14px; padding:12px 4px; border-bottom:1px solid var(--line); ${passado ? 'opacity:0.55;' : ''}">
          <div style="text-align:center; min-width:52px;">
            <div class="display" style="font-size:1.1rem; color:var(--ink-900);">${formatarDia(e.data)}</div>
            <div style="font-size:0.68rem; color:var(--ink-muted); text-transform:uppercase;">${formatarMesAbrev(e.data)}</div>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600;">${escapeHtml(e.titulo || e.tipo || '(sem título)')}</div>
            <div style="font-size:0.78rem; color:var(--ink-muted);">
              ${escapeHtml(e.tipo || '')} ${e.horario ? '· ' + e.horario : ''} ${e.local ? '· ' + escapeHtml(e.local) : ''} ${e.filial ? '· ' + escapeHtml(e.filial) : ''}
            </div>
          </div>
          <button class="btn btn-ghost" data-action="editar" data-id="${e.id}" style="padding:6px 10px;">Editar</button>
        </div>
      `;
    }).join('');

    lista.querySelectorAll('[data-action="editar"]').forEach(btn => {
      btn.addEventListener('click', () => abrirFormulario(btn.dataset.id, eventos));
    });
  }

  // -----------------------------------------------------------------
  // Painel "Eventos próximos" no dashboard
  // -----------------------------------------------------------------
  async function atualizarPainelDashboard(igrejaId) {
    const painel = document.getElementById('eventos-empty');
    if (!painel || !igrejaId) return;

    try {
      const snap = await db.collection('agenda').where('igrejaId', '==', igrejaId).get();
      const hojeISO = new Date().toISOString().slice(0, 10);
      let eventos = [];
      snap.forEach(doc => eventos.push(doc.data()));
      eventos = eventos.filter(e => e.data >= hojeISO).sort((a, b) => (a.data + (a.horario || '')).localeCompare(b.data + (b.horario || '')));

      if (eventos.length === 0) return; // mantém o empty-state padrão

      const proximos = eventos.slice(0, 4);
      painel.outerHTML = `
        <div id="eventos-empty">
          ${proximos.map(e => `
            <div style="display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--line);">
              <div style="text-align:center; min-width:44px;">
                <div class="display" style="font-size:1rem;">${formatarDia(e.data)}</div>
                <div style="font-size:0.62rem; color:var(--ink-muted); text-transform:uppercase;">${formatarMesAbrev(e.data)}</div>
              </div>
              <div style="flex:1; min-width:0; font-size:0.85rem;">
                <div style="font-weight:600;">${escapeHtml(e.titulo || e.tipo || '')}</div>
                <div style="font-size:0.72rem; color:var(--ink-muted);">${e.horario || ''} ${e.local ? '· ' + escapeHtml(e.local) : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>`;
    } catch (err) {
      console.warn('Painel de eventos ainda não disponível:', err.message);
    }
  }

  // -----------------------------------------------------------------
  // Formulário
  // -----------------------------------------------------------------
  function limparFormulario() {
    eventoEmEdicaoId = null;
    document.getElementById('ev-tipo').selectedIndex = 0;
    document.getElementById('ev-titulo').value = '';
    document.getElementById('ev-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('ev-horario').value = '';
    document.getElementById('ev-local').value = '';
    document.getElementById('ev-filial').value = '';
    document.getElementById('ev-descricao').value = '';
    document.getElementById('evento-form-titulo').textContent = 'Novo evento';
  }

  function abrirFormulario(id, listaAtual) {
    limparFormulario();
    if (id) {
      const e = listaAtual.find(x => x.id === id);
      if (!e) return;
      eventoEmEdicaoId = id;
      document.getElementById('evento-form-titulo').textContent = 'Editar evento';
      if (e.tipo) document.getElementById('ev-tipo').value = e.tipo;
      document.getElementById('ev-titulo').value = e.titulo || '';
      document.getElementById('ev-data').value = e.data || '';
      document.getElementById('ev-horario').value = e.horario || '';
      document.getElementById('ev-local').value = e.local || '';
      document.getElementById('ev-filial').value = e.filial || '';
      document.getElementById('ev-descricao').value = e.descricao || '';
    }
    viewLista.classList.add('hidden');
    viewForm.classList.remove('hidden');
  }

  document.getElementById('btn-novo-evento').addEventListener('click', () => abrirFormulario(null));
  document.getElementById('btn-cancelar-evento').addEventListener('click', () => abrirLista());
  document.getElementById('btn-cancelar-evento-2').addEventListener('click', () => abrirLista());

  document.getElementById('btn-salvar-evento').addEventListener('click', async () => {
    const titulo = document.getElementById('ev-titulo').value.trim();
    const data = document.getElementById('ev-data').value;
    if (!titulo || !data) {
      alert('Preencha ao menos o título e a data do evento.');
      return;
    }

    const dados = {
      igrejaId: window.currentIgrejaId,
      tipo: document.getElementById('ev-tipo').value,
      titulo,
      data,
      horario: document.getElementById('ev-horario').value,
      local: document.getElementById('ev-local').value.trim(),
      filial: document.getElementById('ev-filial').value.trim(),
      descricao: document.getElementById('ev-descricao').value.trim(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      if (eventoEmEdicaoId) {
        await db.collection('agenda').doc(eventoEmEdicaoId).update(dados);
      } else {
        dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('agenda').add(dados);
      }
      await abrirLista();
      await atualizarPainelDashboard(window.currentIgrejaId);
    } catch (err) {
      alert('Erro ao salvar evento: ' + err.message);
    }
  });

  // -----------------------------------------------------------------
  // Utilitários
  // -----------------------------------------------------------------
  function formatarDia(iso) {
    if (!iso) return '--';
    return iso.split('-')[2];
  }
  function formatarMesAbrev(iso) {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    if (!iso) return '';
    return meses[parseInt(iso.split('-')[1], 10) - 1] || '';
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  window.AgendaModule = { abrirLista, atualizarPainelDashboard };
})();
