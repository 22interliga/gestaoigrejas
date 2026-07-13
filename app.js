// ===================================================================
// Sistema de Gestão para Igrejas — app.js
// Módulo 1: Fundação (Auth, perfis, cadastro da igreja, dashboard shell)
// ===================================================================

let criandoIgreja = false; // evita que o listener de auth interfira durante o cadastro inicial

const PERFIL_LABELS = {
  admin_geral: "Administrador Geral",
  pastor_presidente: "Pastor Presidente",
  pastor_filial: "Pastor de Filial",
  tesoureiro: "Tesoureiro",
  secretario: "Secretário",
  lider: "Líder",
  leitura: "Somente leitura"
};

const els = {
  authScreen: document.getElementById('auth-screen'),
  setupScreen: document.getElementById('setup-screen'),
  app: document.getElementById('app'),
  authError: document.getElementById('auth-error'),
  setupError: document.getElementById('setup-error'),
};

function showOnly(el) {
  [els.authScreen, els.setupScreen, els.app].forEach(e => e.classList.add('hidden'));
  el.classList.remove('hidden');
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}
function clearError(el) {
  el.style.display = 'none';
  el.textContent = '';
}

// ---------------------------------------------------------------
// Navegação (login <-> cadastro de igreja)
// ---------------------------------------------------------------
document.getElementById('link-primeiro-acesso').addEventListener('click', (e) => {
  e.preventDefault();
  clearError(els.authError);
  showOnly(els.setupScreen);
});
document.getElementById('link-voltar-login').addEventListener('click', (e) => {
  e.preventDefault();
  clearError(els.setupError);
  showOnly(els.authScreen);
});

// ---------------------------------------------------------------
// Login
// ---------------------------------------------------------------
document.getElementById('btn-login').addEventListener('click', async () => {
  clearError(els.authError);
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;

  if (!email || !senha) {
    showError(els.authError, 'Preencha e-mail e senha.');
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, senha);
    // onAuthStateChanged cuida do redirecionamento
  } catch (err) {
    showError(els.authError, traduzErroFirebase(err));
  }
});

// ---------------------------------------------------------------
// Cadastro inicial da igreja (primeiro acesso)
// ---------------------------------------------------------------
document.getElementById('btn-setup').addEventListener('click', async () => {
  clearError(els.setupError);

  const nomeIgreja = document.getElementById('setup-igreja-nome').value.trim();
  const cnpj = document.getElementById('setup-cnpj').value.trim();
  const cidade = document.getElementById('setup-cidade').value.trim();
  const endereco = document.getElementById('setup-endereco').value.trim();
  const whatsapp = document.getElementById('setup-whatsapp').value.trim();
  const pastorPresidente = document.getElementById('setup-pastor').value.trim();

  const adminNome = document.getElementById('setup-admin-nome').value.trim();
  const adminEmail = document.getElementById('setup-admin-email').value.trim();
  const adminSenha = document.getElementById('setup-admin-senha').value;

  if (!nomeIgreja || !adminNome || !adminEmail || !adminSenha) {
    showError(els.setupError, 'Preencha ao menos: nome da igreja, seu nome, e-mail e senha.');
    return;
  }
  if (adminSenha.length < 6) {
    showError(els.setupError, 'A senha precisa ter ao menos 6 caracteres.');
    return;
  }

  try {
    criandoIgreja = true;

    // 1. Cria o usuário de autenticação
    const cred = await auth.createUserWithEmailAndPassword(adminEmail, adminSenha);
    const uid = cred.user.uid;

    // 2. Cria o documento da igreja
    const igrejaRef = await db.collection('igrejas').add({
      nome: nomeIgreja,
      cnpj: cnpj || null,
      cidade: cidade || null,
      endereco: endereco || null,
      whatsapp: whatsapp || null,
      pastorPresidente: pastorPresidente || null,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      criadoPor: uid
    });

    // 3. Cria o documento do usuário (perfil admin geral)
    await db.collection('usuarios').doc(uid).set({
      nome: adminNome,
      email: adminEmail,
      perfil: 'admin_geral',
      igrejaId: igrejaRef.id,
      filialId: null,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Só agora liberamos o listener de auth para montar o app
    criandoIgreja = false;
    await processarLogin(cred.user);
  } catch (err) {
    criandoIgreja = false;
    showError(els.setupError, traduzErroFirebase(err));
  }
});

// ---------------------------------------------------------------
// Logout
// ---------------------------------------------------------------
document.getElementById('btn-logout').addEventListener('click', async () => {
  await auth.signOut();
});

// ---------------------------------------------------------------
// Estado de autenticação
// ---------------------------------------------------------------
auth.onAuthStateChanged(async (user) => {
  if (criandoIgreja) return; // ignora enquanto o cadastro inicial está em andamento

  if (!user) {
    showOnly(els.authScreen);
    return;
  }
  await processarLogin(user);
});

async function processarLogin(user) {
  try {
    const usuarioSnap = await db.collection('usuarios').doc(user.uid).get();
    if (!usuarioSnap.exists) {
      // Usuário autenticado mas sem registro em /usuarios — situação inconsistente
      showError(els.authError, 'Conta sem perfil vinculado a uma igreja. Contate o administrador.');
      await auth.signOut();
      return;
    }
    const usuario = usuarioSnap.data();
    const igrejaSnap = await db.collection('igrejas').doc(usuario.igrejaId).get();
    const igreja = igrejaSnap.exists ? igrejaSnap.data() : null;

    montarApp(usuario, igreja, igrejaSnap.id);
  } catch (err) {
    console.error(err);
    showError(els.authError, 'Erro ao carregar seus dados. Tente novamente.');
  }
}

// ---------------------------------------------------------------
// Monta o app principal após login bem-sucedido
// ---------------------------------------------------------------
function montarApp(usuario, igreja, igrejaId) {
  showOnly(els.app);

  // Contexto global para outros módulos (membros.js, filiais.js, etc.)
  window.currentUsuario = usuario;
  window.currentIgreja = igreja;
  window.currentIgrejaId = igrejaId;

  document.getElementById('sb-igreja-nome').textContent = igreja ? igreja.nome : '—';
  document.getElementById('sb-perfil').textContent = PERFIL_LABELS[usuario.perfil] || usuario.perfil;
  document.getElementById('user-nome').textContent = usuario.nome;
  document.getElementById('user-avatar').textContent = (usuario.nome || '?').trim().charAt(0).toUpperCase();

  renderDadosIgreja(igreja, usuario);
  carregarEstatisticas(igrejaId);
  configurarNavegacao(usuario);
  if (window.TesourariaModule) window.TesourariaModule.atualizarPainelDashboard(igrejaId);
  if (window.AgendaModule) window.AgendaModule.atualizarPainelDashboard(igrejaId);
}

function renderDadosIgreja(igreja, usuario) {
  const el = document.getElementById('dados-igreja-view');
  if (!igreja) {
    el.innerHTML = '<div class="empty-state"><div class="display">Sem dados da igreja</div></div>';
    return;
  }
  el.innerHTML = `
    <div class="field-row">
      <div class="field"><label>Nome</label><input value="${escapeHtml(igreja.nome || '')}" disabled></div>
      <div class="field"><label>Cidade</label><input value="${escapeHtml(igreja.cidade || '—')}" disabled></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Endereço</label><input value="${escapeHtml(igreja.endereco || '—')}" disabled></div>
      <div class="field"><label>WhatsApp</label><input value="${escapeHtml(igreja.whatsapp || '—')}" disabled></div>
    </div>
    <div class="field"><label>Pastor Presidente</label><input value="${escapeHtml(igreja.pastorPresidente || '—')}" disabled></div>
    ${usuario.perfil === 'admin_geral' ? '<div style="font-size:0.8rem; color:#6B6558;">A edição completa destes dados será liberada no módulo de Cadastro da Igreja.</div>' : ''}
  `;
}

// ---------------------------------------------------------------
// Estatísticas do dashboard (placeholders reais via Firestore contagem)
// Os módulos de Membros/Filiais preencherão essas coleções depois.
// ---------------------------------------------------------------
async function carregarEstatisticas(igrejaId) {
  try {
    const [membrosSnap, filiaisSnap, diretoriaSnap] = await Promise.all([
      db.collection('membros').where('igrejaId', '==', igrejaId).get(),
      db.collection('filiais').where('igrejaId', '==', igrejaId).get(),
      db.collection('diretoria').where('igrejaId', '==', igrejaId).get()
    ]);

    let ativos = 0, congregados = 0, visitantes = 0;
    membrosSnap.forEach(doc => {
      const m = doc.data();
      if (m.situacao === 'Ativo') ativos++;
      if (m.situacao === 'Congregado') congregados++;
      if (m.situacao === 'Visitante') visitantes++;
    });

    document.getElementById('stat-membros').textContent = ativos;
    document.getElementById('stat-congregados').textContent = congregados;
    document.getElementById('stat-visitantes').textContent = visitantes;
    document.getElementById('stat-filiais').textContent = filiaisSnap.size;
    document.getElementById('stat-lideres').textContent = diretoriaSnap.size;
  } catch (err) {
    // Coleções ainda não existem nos primeiros acessos — mantém zeros
    console.warn('Estatísticas ainda não disponíveis:', err.message);
  }
}

// ---------------------------------------------------------------
// Navegação lateral
// ---------------------------------------------------------------
function configurarNavegacao(usuario) {
  const navItems = document.querySelectorAll('.nav-item[data-route]');
  const placeholderTitle = document.getElementById('placeholder-title');

  const rotaLabels = {};

  // Todas as seções de conteúdo conhecidas — a navegação sempre esconde
  // todas e mostra só a da rota clicada.
  const todasAsViews = () => document.querySelectorAll('#route-content > section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const rota = item.dataset.route;

      todasAsViews().forEach(v => v.classList.add('hidden'));

      if (rota === 'dashboard') {
        document.getElementById('view-dashboard').classList.remove('hidden');
      } else if (rota === 'membros') {
        document.getElementById('view-membros').classList.remove('hidden');
        if (window.MembrosModule) window.MembrosModule.abrirLista();
      } else if (rota === 'filiais') {
        document.getElementById('view-filiais').classList.remove('hidden');
        if (window.FiliaisModule) window.FiliaisModule.abrirLista();
      } else if (rota === 'tesouraria') {
        document.getElementById('view-tesouraria').classList.remove('hidden');
        if (window.TesourariaModule) window.TesourariaModule.abrirLista();
      } else if (rota === 'inventario') {
        document.getElementById('view-inventario').classList.remove('hidden');
        if (window.InventarioModule) window.InventarioModule.abrirLista();
      } else if (rota === 'comunicacao') {
        document.getElementById('view-comunicacao').classList.remove('hidden');
        if (window.ComunicacaoModule) window.ComunicacaoModule.abrirLista();
      } else if (rota === 'diretoria') {
        document.getElementById('view-diretoria').classList.remove('hidden');
        if (window.DiretoriaModule) window.DiretoriaModule.abrirLista();
      } else if (rota === 'agenda') {
        document.getElementById('view-agenda').classList.remove('hidden');
        if (window.AgendaModule) window.AgendaModule.abrirLista();
      } else if (rota === 'relatorios') {
        document.getElementById('view-relatorios').classList.remove('hidden');
      } else {
        document.getElementById('view-placeholder').classList.remove('hidden');
        placeholderTitle.textContent = `Módulo "${rotaLabels[rota]}" — em construção`;
      }
    });
  });
}

// ---------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function traduzErroFirebase(err) {
  const map = {
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.'
  };
  return map[err.code] || ('Erro: ' + err.message);
}
