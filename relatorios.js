// ===================================================================
// Sistema de Gestão para Igrejas — relatorios.js
// Módulo 9: Relatórios (com exportação em PDF e Excel)
// ===================================================================

(function () {
  let relatorioAtual = null; // { titulo, colunas: [...], linhas: [[...]] }

  const preview = document.getElementById('rel-preview');
  const acoes = document.getElementById('rel-acoes');

  // -----------------------------------------------------------------
  // Cada relatório sabe buscar seus próprios dados e formatar linhas
  // -----------------------------------------------------------------
  const GERADORES = {
    membros: {
      titulo: 'Membros',
      colunas: ['Nome', 'Situação', 'Cargo', 'Filial', 'Cidade', 'Telefone'],
      async gerar(igrejaId) {
        const snap = await db.collection('membros').where('igrejaId', '==', igrejaId).get();
        const linhas = [];
        snap.forEach(doc => {
          const m = doc.data();
          linhas.push([m.nome || '', m.situacao || '', m.cargo || '', m.filial || 'Sede', m.cidade || '', m.telefone || m.whatsapp || '']);
        });
        return linhas.sort((a, b) => a[0].localeCompare(b[0]));
      }
    },
    visitantes: {
      titulo: 'Visitantes',
      colunas: ['Nome', 'Filial', 'Cidade', 'Telefone'],
      async gerar(igrejaId) {
        const snap = await db.collection('membros').where('igrejaId', '==', igrejaId).where('situacao', '==', 'Visitante').get();
        const linhas = [];
        snap.forEach(doc => {
          const m = doc.data();
          linhas.push([m.nome || '', m.filial || 'Sede', m.cidade || '', m.telefone || m.whatsapp || '']);
        });
        return linhas;
      }
    },
    congregados: {
      titulo: 'Congregados',
      colunas: ['Nome', 'Filial', 'Cidade', 'Telefone'],
      async gerar(igrejaId) {
        const snap = await db.collection('membros').where('igrejaId', '==', igrejaId).where('situacao', '==', 'Congregado').get();
        const linhas = [];
        snap.forEach(doc => {
          const m = doc.data();
          linhas.push([m.nome || '', m.filial || 'Sede', m.cidade || '', m.telefone || m.whatsapp || '']);
        });
        return linhas;
      }
    },
    batismos: {
      titulo: 'Batismos',
      colunas: ['Nome', 'Data de batismo', 'Filial'],
      async gerar(igrejaId) {
        const snap = await db.collection('membros').where('igrejaId', '==', igrejaId).get();
        const linhas = [];
        snap.forEach(doc => {
          const m = doc.data();
          if (m.batismo) linhas.push([m.nome || '', formatarData(m.batismo), m.filial || 'Sede']);
        });
        return linhas.sort((a, b) => a[1].localeCompare(b[1]));
      }
    },
    aniversariantes: {
      titulo: 'Aniversariantes do mês',
      colunas: ['Nome', 'Data de nascimento', 'Telefone'],
      async gerar(igrejaId) {
        const snap = await db.collection('membros').where('igrejaId', '==', igrejaId).get();
        const mesAtual = new Date().getMonth() + 1;
        const linhas = [];
        snap.forEach(doc => {
          const m = doc.data();
          if (m.nascimento && parseInt(m.nascimento.split('-')[1], 10) === mesAtual) {
            linhas.push([m.nome || '', formatarData(m.nascimento), m.telefone || m.whatsapp || '']);
          }
        });
        return linhas.sort((a, b) => a[1].localeCompare(b[1]));
      }
    },
    filiais: {
      titulo: 'Filiais',
      colunas: ['Nome', 'Pastor responsável', 'Cidade/Estado', 'Telefone'],
      async gerar(igrejaId) {
        const snap = await db.collection('filiais').where('igrejaId', '==', igrejaId).get();
        const linhas = [];
        snap.forEach(doc => {
          const f = doc.data();
          linhas.push([f.nome || '', f.pastor || '', [f.cidade, f.estado].filter(Boolean).join('/'), f.telefone || f.whatsapp || '']);
        });
        return linhas;
      }
    },
    diretoria: {
      titulo: 'Diretoria',
      colunas: ['Cargo', 'Nome', 'Telefone', 'E-mail'],
      async gerar(igrejaId) {
        const snap = await db.collection('diretoria').where('igrejaId', '==', igrejaId).get();
        const linhas = [];
        snap.forEach(doc => {
          const d = doc.data();
          linhas.push([d.cargo || '', d.nome || '', d.telefone || '', d.email || '']);
        });
        return linhas;
      }
    },
    patrimonio: {
      titulo: 'Patrimônio (Inventário)',
      colunas: ['Categoria', 'Descrição', 'Nº Patrimônio', 'Estado', 'Valor (R$)'],
      async gerar(igrejaId) {
        const snap = await db.collection('inventario').where('igrejaId', '==', igrejaId).get();
        const linhas = [];
        snap.forEach(doc => {
          const i = doc.data();
          linhas.push([i.categoria || '', i.descricao || '', i.numeroPatrimonio || '', i.estado || '', formatarValor(i.valor)]);
        });
        return linhas;
      }
    },
    eventos: {
      titulo: 'Eventos (Agenda)',
      colunas: ['Data', 'Tipo', 'Título', 'Local'],
      async gerar(igrejaId) {
        const snap = await db.collection('agenda').where('igrejaId', '==', igrejaId).get();
        const linhas = [];
        snap.forEach(doc => {
          const e = doc.data();
          linhas.push([formatarData(e.data), e.tipo || '', e.titulo || '', e.local || '']);
        });
        return linhas.sort((a, b) => a[0].localeCompare(b[0]));
      }
    },
    financeiro: {
      titulo: 'Financeiro (lançamentos)',
      colunas: ['Data', 'Tipo', 'Categoria', 'Valor (R$)', 'Descrição'],
      async gerar(igrejaId) {
        const snap = await db.collection('financeiro').where('igrejaId', '==', igrejaId).get();
        const linhas = [];
        snap.forEach(doc => {
          const f = doc.data();
          linhas.push([formatarData(f.data), f.tipo === 'entrada' ? 'Entrada' : 'Saída', f.categoria || '', formatarValor(f.valor), f.descricao || '']);
        });
        return linhas.sort((a, b) => b[0].localeCompare(a[0]));
      }
    },
    tesouraria: {
      titulo: 'Tesouraria (resumo mensal)',
      colunas: ['Mês', 'Entradas (R$)', 'Saídas (R$)', 'Saldo (R$)'],
      async gerar(igrejaId) {
        const snap = await db.collection('financeiro').where('igrejaId', '==', igrejaId).get();
        const porMes = {};
        snap.forEach(doc => {
          const f = doc.data();
          const mes = (f.data || '').slice(0, 7);
          if (!mes) return;
          if (!porMes[mes]) porMes[mes] = { entradas: 0, saidas: 0 };
          if (f.tipo === 'entrada') porMes[mes].entradas += Number(f.valor) || 0;
          else porMes[mes].saidas += Number(f.valor) || 0;
        });
        return Object.entries(porMes)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([mes, v]) => [formatarMes(mes), formatarValor(v.entradas), formatarValor(v.saidas), formatarValor(v.entradas - v.saidas)]);
      }
    }
  };

  document.getElementById('btn-gerar-relatorio').addEventListener('click', async () => {
    const tipo = document.getElementById('rel-tipo').value;
    const gerador = GERADORES[tipo];
    const igrejaId = window.currentIgrejaId;
    if (!gerador || !igrejaId) return;

    preview.innerHTML = '<div class="empty-state"><div class="display">Gerando relatório...</div></div>';
    acoes.style.display = 'none';

    try {
      const linhas = await gerador.gerar(igrejaId);
      relatorioAtual = { titulo: gerador.titulo, colunas: gerador.colunas, linhas };
      renderPreview(relatorioAtual);
      acoes.style.display = linhas.length > 0 ? 'flex' : 'none';
    } catch (err) {
      console.error(err);
      preview.innerHTML = `<div class="empty-state"><div class="display">Erro ao gerar relatório</div><div>${escapeHtml(err.message)}</div></div>`;
    }
  });

  function renderPreview(rel) {
    if (rel.linhas.length === 0) {
      preview.innerHTML = `<div class="empty-state"><div class="display">Nenhum dado encontrado para "${escapeHtml(rel.titulo)}"</div></div>`;
      return;
    }

    preview.innerHTML = `
      <div style="font-size:0.82rem; color:var(--ink-muted); margin-bottom:10px;">
        ${rel.linhas.length} registro${rel.linhas.length === 1 ? '' : 's'} encontrado${rel.linhas.length === 1 ? '' : 's'}
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
          <thead>
            <tr>${rel.colunas.map(c => `<th style="text-align:left; padding:8px 10px; border-bottom:2px solid var(--line); color:var(--ink-700); white-space:nowrap;">${escapeHtml(c)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rel.linhas.map(linha => `<tr>${linha.map(v => `<td style="padding:7px 10px; border-bottom:1px solid var(--line);">${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // -----------------------------------------------------------------
  // Exportação
  // -----------------------------------------------------------------
  document.getElementById('btn-exportar-pdf').addEventListener('click', () => {
    if (!relatorioAtual || relatorioAtual.linhas.length === 0) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    const igreja = window.currentIgreja || {};
    doc.setFontSize(14);
    doc.text(igreja.nome || 'Relatório', 14, 16);
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(`${relatorioAtual.titulo} — gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 23);

    doc.autoTable({
      startY: 28,
      head: [relatorioAtual.colunas],
      body: relatorioAtual.linhas,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 33, 58] },
    });

    doc.save(`${slug(relatorioAtual.titulo)}.pdf`);
  });

  document.getElementById('btn-exportar-excel').addEventListener('click', () => {
    if (!relatorioAtual || relatorioAtual.linhas.length === 0) return;
    const dados = [relatorioAtual.colunas, ...relatorioAtual.linhas];
    const ws = XLSX.utils.aoa_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, relatorioAtual.titulo.slice(0, 31));
    XLSX.writeFile(wb, `${slug(relatorioAtual.titulo)}.xlsx`);
  });

  // -----------------------------------------------------------------
  // Utilitários
  // -----------------------------------------------------------------
  function formatarData(iso) {
    if (!iso) return '';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  function formatarMes(iso) {
    if (!iso) return '';
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const [ano, mes] = iso.split('-');
    return `${meses[parseInt(mes, 10) - 1]}/${ano}`;
  }
  function formatarValor(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function slug(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
})();
