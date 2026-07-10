// ===================================================================
// Sistema de Gestão para Igrejas — comunicacao.js
// Módulo 6: Comunicação (mensagens segmentadas, modelos, histórico)
// ===================================================================
//
// Este sistema roda inteiramente no navegador (GitHub Pages + Firebase),
// sem servidor próprio de envio. Por isso, o envio de WhatsApp e e-mail
// é feito abrindo um link por destinatário (wa.me / mailto), que a
// pessoa confirma manualmente — não existe disparo em massa automático
// sem um serviço de backend dedicado (ex: WhatsApp Business API).
// ===================================================================

(function () {
  const segmentoSelect = document.getElementById('com-segmento');
  const campoExtraWrap = document.getElementById('com-campo-extra-wrap');
  const campoExtraLabel = document.getElementById('com-campo-extra-label');
  const campoExtra = document.getElementById('com-campo-extra');
  const modeloSelect = document.getElementById('com-modelo-select');
  const destinatariosEl = document.getElementById('com-destinatarios');
  const historicoEl = document.getElementById('com-historico');

  async function abrirLista() {
    await Promise.all([carregarModelos(), carregarHistorico()]);
  }

  segmentoSelect.addEventListener('change', () => {
    const v = segmentoSelect.value;
    if (v === 'departamento') {
      campoExtraWrap.style.display = 'block';
      campoExtraLabel.textContent = 'Departamento';
      campoExtra.placeholder = 'Ex: Louvor';
    } else if (v === 'filial') {
      campoExtraWrap.style.display = 'block';
      campoExtraLabel.textContent = 'Filial';
      campoExtra.placeholder = 'Ex: Sede';
    } else {
      campoExtraWrap.style.display = 'none';
    }
  });

  // -----------------------------------------------------------------
  // Modelos de mensagem
  // -----------------------------------------------------------------
  async function carregarModelos() {
    const igrejaId = window.currentIgrejaId;
    if (!igrejaId) return;
    try {
      const snap = await db.collection('modelos_mensagem').where('igrejaId', '==', igrejaId).get();
      const modelos = [];
      snap.forEach(doc => modelos.push({ id: doc.id, ...doc.data() }));
      modelos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

      modeloSelect.innerHTML = '<option value="">— nenhum —</option>' +
        modelos.map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');
      modeloSelect.dataset.modelos = JSON.stringify(modelos);
    } catch (err) {
      console.warn('Erro ao carregar modelos:', err.message);
    }
  }

  modeloSelect.addEventListener('change', () => {
    if (!modeloSelect.value) return;
    const modelos = JSON.parse(modeloSelect.dataset.modelos || '[]');
    const m = modelos.find(x => x.id === modeloSelect.value);
    if (m) document.getElementById('com-mensagem').value = m.conteudo;
  });

  document.getElementById('btn-salvar-modelo').addEventListener('click', async () => {
    const conteudo = document.getElementById('com-mensagem').value.trim();
    if (!conteudo) {
      alert('Escreva a mensagem antes de salvar como modelo.');
      return;
    }
    const nome = prompt('Nome deste modelo (ex: "Convite culto especial"):');
    if (!nome) return;

    try {
      await db.collection('modelos_mensagem').add({
        igrejaId: window.currentIgrejaId,
        nome: nome.trim(),
        conteudo,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      await carregarModelos();
      alert('Modelo salvo!');
    } catch (err) {
      alert('Erro ao salvar modelo: ' + err.message);
    }
  });

  // -----------------------------------------------------------------
  // Buscar destinatários conforme o segmento
  // -----------------------------------------------------------------
  document.getElementById('btn-buscar-destinatarios').addEventListener('click', async () => {
    const igrejaId = window.currentIgrejaId;
    const mensagem = document.getElementById('com-mensagem').value.trim();
    if (!mensagem) {
      alert('Escreva a mensagem antes de buscar os destinatários.');
      return;
    }

    destinatariosEl.innerHTML = '<div class="empty-state"><div class="display">Buscando...</div></div>';

    try {
      const snap = await db.collection('membros').where('igrejaId', '==', igrejaId).get();
      let membros = [];
      snap.forEach(doc => membros.push({ id: doc.id, ...doc.data() }));

      const segmento = segmentoSelect.value;
      const extra = campoExtra.value.trim().toLowerCase();

      if (segmento === 'lideres') {
        membros = membros.filter(m => (m.cargo || '').toLowerCase().includes('líder') || (m.cargo || '').toLowerCase().includes('lider'));
      } else if (segmento === 'departamento') {
        membros = membros.filter(m => (m.departamento || '').toLowerCase().includes(extra));
      } else if (segmento === 'filial') {
        membros = membros.filter(m => (m.filial || 'Sede').toLowerCase().includes(extra));
      } else if (segmento === 'aniversariantes') {
        const hoje = new Date();
        membros = membros.filter(m => {
          if (!m.nascimento) return false;
          const [, mes, dia] = m.nascimento.split('-');
          return Number(mes) === hoje.getMonth() + 1 && Number(dia) === hoje.getDate();
        });
      }
      // 'todos' não filtra

      renderDestinatarios(membros, mensagem);

      // Registra no histórico o preparo deste envio
      await db.collection('historico_envios').add({
        igrejaId,
        segmento,
        filtro: extra || null,
        canal: document.getElementById('com-canal').value,
        mensagem,
        quantidadeDestinatarios: membros.length,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      await carregarHistorico();
    } catch (err) {
      console.error(err);
      destinatariosEl.innerHTML = `<div class="empty-state"><div class="display">Erro ao buscar destinatários</div><div>${escapeHtml(err.message)}</div></div>`;
    }
  });

  function renderDestinatarios(membros, mensagemBase) {
    const canal = document.getElementById('com-canal').value;

    if (membros.length === 0) {
      destinatariosEl.innerHTML = '<div class="empty-state"><div class="display">Nenhum destinatário encontrado para esse filtro</div></div>';
      return;
    }

    destinatariosEl.innerHTML = `
      <div style="font-size:0.85rem; color:var(--ink-muted); margin-bottom:10px;">
        ${membros.length} destinatário${membros.length === 1 ? '' : 's'} encontrado${membros.length === 1 ? '' : 's'} —
        clique em cada um pra abrir o ${canal === 'whatsapp' ? 'WhatsApp' : 'e-mail'} já com a mensagem pronta.
      </div>
      ${membros.map(m => {
        const texto = mensagemBase.replace(/\{nome\}/g, m.nome || '');
        let link, desabilitado = false;
        if (canal === 'whatsapp') {
          const numero = (m.whatsapp || m.telefone || '').replace(/\D/g, '');
          if (!numero) { desabilitado = true; link = '#'; }
          else link = `https://wa.me/55${numero}?text=${encodeURIComponent(texto)}`;
        } else {
          if (!m.email) { desabilitado = true; link = '#'; }
          else link = `mailto:${m.email}?body=${encodeURIComponent(texto)}`;
        }
        return `
          <div style="display:flex; align-items:center; gap:12px; padding:10px 4px; border-bottom:1px solid var(--line);">
            <div style="flex:1;">${escapeHtml(m.nome || '(sem nome)')}</div>
            ${desabilitado
              ? `<span style="font-size:0.78rem; color:var(--warn-600);">sem ${canal === 'whatsapp' ? 'WhatsApp' : 'e-mail'} cadastrado</span>`
              : `<a href="${link}" target="_blank" class="btn btn-primary" style="padding:6px 14px; text-decoration:none;">Enviar</a>`}
          </div>
        `;
      }).join('')}
    `;
  }

  // -----------------------------------------------------------------
  // Histórico de envios
  // -----------------------------------------------------------------
  async function carregarHistorico() {
    const igrejaId = window.currentIgrejaId;
    if (!igrejaId) return;
    try {
      const snap = await db.collection('historico_envios').where('igrejaId', '==', igrejaId).get();
      let historico = [];
      snap.forEach(doc => historico.push(doc.data()));
      historico.sort((a, b) => {
        const ta = a.criadoEm && a.criadoEm.toMillis ? a.criadoEm.toMillis() : 0;
        const tb = b.criadoEm && b.criadoEm.toMillis ? b.criadoEm.toMillis() : 0;
        return tb - ta;
      });
      historico = historico.slice(0, 20);

      if (historico.length === 0) {
        historicoEl.innerHTML = '<div class="empty-state"><div class="display">Nenhum envio registrado ainda</div></div>';
        return;
      }

      const segLabels = { todos: 'Todos os membros', lideres: 'Líderes', departamento: 'Departamento', filial: 'Filial', aniversariantes: 'Aniversariantes' };

      historicoEl.innerHTML = historico.map(h => `
        <div style="padding:10px 4px; border-bottom:1px solid var(--line);">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
            <span style="font-weight:600;">${segLabels[h.segmento] || h.segmento}${h.filtro ? ' — ' + escapeHtml(h.filtro) : ''}</span>
            <span style="color:var(--ink-muted);">${h.canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'} · ${h.quantidadeDestinatarios} destinatário(s)</span>
          </div>
          <div style="font-size:0.8rem; color:var(--ink-muted); margin-top:2px;">${escapeHtml((h.mensagem || '').slice(0, 100))}${(h.mensagem || '').length > 100 ? '…' : ''}</div>
        </div>
      `).join('');
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err.message);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  window.ComunicacaoModule = { abrirLista };
})();
