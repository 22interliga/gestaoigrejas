// ===================================================================
// Sistema de Gestão para Igrejas — membros.js
// Módulo 2: Membros (cadastro, busca, carteirinha em PDF)
// ===================================================================

(function () {
  let membroEmEdicaoId = null;
  let fotoBase64Atual = null;

  const viewMembros = document.getElementById('view-membros');
  const viewForm = document.getElementById('view-membro-form');
  const lista = document.getElementById('membros-lista');

  // -----------------------------------------------------------------
  // Abrir a lista (chamado pela navegação lateral)
  // -----------------------------------------------------------------
  async function abrirLista() {
    viewForm.classList.add('hidden');
    viewMembros.classList.remove('hidden');
    await carregarMembros();
  }

  async function carregarMembros(filtros) {
    lista.innerHTML = '<div class="empty-state"><div class="display">Carregando...</div></div>';
    const igrejaId = window.currentIgrejaId;
    if (!igrejaId) return;

    try {
      let query = db.collection('membros').where('igrejaId', '==', igrejaId);
      const snap = await query.get();

      let membros = [];
      snap.forEach(doc => membros.push({ id: doc.id, ...doc.data() }));

      if (filtros) {
        const norm = s => (s || '').toString().toLowerCase();
        if (filtros.nome) membros = membros.filter(m => norm(m.nome).includes(norm(filtros.nome)));
        if (filtros.cargo) membros = membros.filter(m => norm(m.cargo).includes(norm(filtros.cargo)));
        if (filtros.ministerio) membros = membros.filter(m => norm(m.ministerio).includes(norm(filtros.ministerio)));
        if (filtros.filial) membros = membros.filter(m => norm(m.filial).includes(norm(filtros.filial)));
        if (filtros.cidade) membros = membros.filter(m => norm(m.cidade).includes(norm(filtros.cidade)));
      }

      membros.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      renderLista(membros);
    } catch (err) {
      console.error(err);
      lista.innerHTML = `<div class="empty-state"><div class="display">Erro ao carregar membros</div><div>${escapeHtml(err.message)}</div></div>`;
    }
  }

  function renderLista(membros) {
    if (membros.length === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          <div class="display">Nenhum membro encontrado</div>
          <div>Cadastre o primeiro membro clicando em "+ Novo membro".</div>
        </div>`;
      return;
    }

    const linhas = membros.map(m => `
      <div style="display:flex; align-items:center; gap:14px; padding:12px 4px; border-bottom:1px solid var(--line);">
        <div style="width:42px; height:42px; border-radius:50%; overflow:hidden; background:var(--cream-200); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); color:var(--ink-500);">
          ${m.foto ? `<img src="${m.foto}" style="width:100%; height:100%; object-fit:cover;">` : (m.nome || '?').charAt(0).toUpperCase()}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600;">${escapeHtml(m.nome || '(sem nome)')}</div>
          <div style="font-size:0.78rem; color:var(--ink-muted);">
            ${escapeHtml(m.cargo || '—')} · ${escapeHtml(m.filial || 'Sede')} ${m.cidade ? '· ' + escapeHtml(m.cidade) : ''}
          </div>
        </div>
        <span class="badge badge-${(m.situacao || 'ativo').toLowerCase()}">${escapeHtml(m.situacao || 'Ativo')}</span>
        <button class="btn btn-ghost" data-action="carteirinha" data-id="${m.id}" style="padding:6px 10px;">Carteirinha</button>
        <button class="btn btn-ghost" data-action="editar" data-id="${m.id}" style="padding:6px 10px;">Editar</button>
      </div>
    `).join('');

    lista.innerHTML = linhas;

    lista.querySelectorAll('[data-action="editar"]').forEach(btn => {
      btn.addEventListener('click', () => abrirFormulario(btn.dataset.id, membros));
    });
    lista.querySelectorAll('[data-action="carteirinha"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const membro = membros.find(m => m.id === btn.dataset.id);
        gerarCarteirinha(membro);
      });
    });
  }

  // -----------------------------------------------------------------
  // Busca
  // -----------------------------------------------------------------
  document.getElementById('btn-buscar-membros').addEventListener('click', () => {
    carregarMembros({
      nome: document.getElementById('f-nome').value,
      cargo: document.getElementById('f-cargo').value,
      ministerio: document.getElementById('f-ministerio').value,
      filial: document.getElementById('f-filial').value,
      cidade: document.getElementById('f-cidade').value,
    });
  });
  document.getElementById('btn-limpar-busca').addEventListener('click', () => {
    ['f-nome', 'f-cargo', 'f-ministerio', 'f-filial', 'f-cidade'].forEach(id => document.getElementById(id).value = '');
    carregarMembros();
  });

  // -----------------------------------------------------------------
  // Formulário (novo / edição)
  // -----------------------------------------------------------------
  const campos = ['nome', 'situacao', 'cpf', 'rg', 'nascimento', 'sexo', 'estado-civil', 'cep',
    'endereco', 'bairro', 'cidade', 'telefone', 'whatsapp', 'email', 'conversao', 'batismo',
    'cargo', 'ministerio', 'departamento', 'filial', 'observacoes'];

  function limparFormulario() {
    membroEmEdicaoId = null;
    fotoBase64Atual = null;
    campos.forEach(c => {
      const el = document.getElementById('m-' + c);
      if (el) el.value = c === 'situacao' ? 'Ativo' : (c === 'sexo' ? 'Feminino' : (c === 'estado-civil' ? 'Solteiro(a)' : ''));
    });
    document.getElementById('m-foto-preview').style.display = 'none';
    document.getElementById('m-foto-preview').src = '';
    document.getElementById('m-foto-input').value = '';
    document.getElementById('membro-form-titulo').textContent = 'Novo membro';
  }

  function abrirFormulario(id, listaAtual) {
    limparFormulario();
    if (id) {
      const m = listaAtual.find(x => x.id === id);
      if (!m) return;
      membroEmEdicaoId = id;
      document.getElementById('membro-form-titulo').textContent = 'Editar membro';
      campos.forEach(c => {
        const el = document.getElementById('m-' + c);
        const valor = m[toCamel(c)];
        if (el && valor !== undefined && valor !== null) el.value = valor;
      });
      if (m.foto) {
        fotoBase64Atual = m.foto;
        document.getElementById('m-foto-preview').src = m.foto;
        document.getElementById('m-foto-preview').style.display = 'block';
      }
    }
    viewMembros.classList.add('hidden');
    viewForm.classList.remove('hidden');
  }

  function toCamel(s) {
    return s.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
  }

  document.getElementById('btn-novo-membro').addEventListener('click', () => abrirFormulario(null));
  document.getElementById('btn-cancelar-membro').addEventListener('click', () => abrirLista());
  document.getElementById('btn-cancelar-membro-2').addEventListener('click', () => abrirLista());

  // Foto: redimensiona antes de converter em base64 (evita documentos gigantes no Firestore)
  document.getElementById('m-foto-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 300;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        fotoBase64Atual = canvas.toDataURL('image/jpeg', 0.75);
        document.getElementById('m-foto-preview').src = fotoBase64Atual;
        document.getElementById('m-foto-preview').style.display = 'block';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-salvar-membro').addEventListener('click', async () => {
    const nome = document.getElementById('m-nome').value.trim();
    if (!nome) {
      alert('O nome do membro é obrigatório.');
      return;
    }

    const dados = {
      igrejaId: window.currentIgrejaId,
      nome,
      situacao: document.getElementById('m-situacao').value,
      cpf: document.getElementById('m-cpf').value.trim(),
      rg: document.getElementById('m-rg').value.trim(),
      nascimento: document.getElementById('m-nascimento').value,
      sexo: document.getElementById('m-sexo').value,
      estadoCivil: document.getElementById('m-estado-civil').value,
      cep: document.getElementById('m-cep').value.trim(),
      endereco: document.getElementById('m-endereco').value.trim(),
      bairro: document.getElementById('m-bairro').value.trim(),
      cidade: document.getElementById('m-cidade').value.trim(),
      telefone: document.getElementById('m-telefone').value.trim(),
      whatsapp: document.getElementById('m-whatsapp').value.trim(),
      email: document.getElementById('m-email').value.trim(),
      conversao: document.getElementById('m-conversao').value,
      batismo: document.getElementById('m-batismo').value,
      cargo: document.getElementById('m-cargo').value.trim(),
      ministerio: document.getElementById('m-ministerio').value.trim(),
      departamento: document.getElementById('m-departamento').value.trim(),
      filial: document.getElementById('m-filial').value.trim() || 'Sede',
      observacoes: document.getElementById('m-observacoes').value.trim(),
      foto: fotoBase64Atual || null,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      if (membroEmEdicaoId) {
        await db.collection('membros').doc(membroEmEdicaoId).update(dados);
      } else {
        dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('membros').add(dados);
      }
      await abrirLista();
    } catch (err) {
      alert('Erro ao salvar membro: ' + err.message);
    }
  });

  // -----------------------------------------------------------------
  // Carteirinha em PDF
  // -----------------------------------------------------------------
  function gerarCarteirinha(m) {
    if (!m) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [90, 55] }); // tamanho cartão

    const igreja = window.currentIgreja || {};

    // Fundo
    doc.setFillColor(22, 33, 58);
    doc.rect(0, 0, 90, 55, 'F');
    doc.setFillColor(201, 162, 39);
    doc.rect(0, 0, 90, 4, 'F');

    // Nome da igreja
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(igreja.nome || 'Igreja', 6, 12);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(201, 162, 39);
    doc.text('CARTEIRA DE MEMBRO', 6, 17);

    // Foto (se houver)
    if (m.foto) {
      try { doc.addImage(m.foto, 'JPEG', 6, 21, 18, 22); } catch (e) { /* formato inválido, ignora */ }
    }

    const xTexto = m.foto ? 27 : 6;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(m.nome || '', 58), xTexto, 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    let y = 32;
    const linha = (label, valor) => {
      if (!valor) return;
      doc.text(`${label}: ${valor}`, xTexto, y);
      y += 4.2;
    };
    linha('Cargo', m.cargo);
    linha('Filial', m.filial);
    linha('Batismo', m.batismo);
    linha('CPF', m.cpf);

    doc.save(`carteirinha-${(m.nome || 'membro').replace(/\s+/g, '-').toLowerCase()}.pdf`);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  window.MembrosModule = { abrirLista };
})();
