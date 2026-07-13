// ===================================================================
// CONFIGURAÇÃO DE MARCA (WHITE-LABEL)
// ===================================================================
// Este é o ÚNICO arquivo que deve mudar de um cliente para outro.
// Todo o resto do sistema (app.js, membros.js, tesouraria.js, etc.)
// é o motor compartilhado — não precisa duplicar nem editar.
//
// Para vender este sistema para uma nova igreja:
//   1. Duplique este repositório (ou use "Use this template" no GitHub)
//   2. Edite só os valores abaixo com a marca da nova igreja
//   3. Troque a logo em /logo.png (mesmo nome de arquivo, nova imagem)
//   4. Publique no GitHub Pages com um domínio/subdomínio próprio
//   5. NÃO precisa criar um Firebase novo — o firebase-config.js pode
//      continuar apontando para o mesmo projeto compartilhado, pois os
//      dados de cada igreja já são isolados por igrejaId no Firestore.
// ===================================================================

const MARCA = {
  // Nome exibido na tela de login e na aba do navegador
  nomeSistema: "Painel de Gestão",

  // Nome curto/comercial da plataforma (aparece em rodapés, se usado)
  nomePlataforma: "Sistema de Gestão para Igrejas",

  // Cores da identidade visual (sobrescrevem o padrão navy/dourado)
  corPrimaria: "#16213A",   // navy — sidebar, cabeçalhos
  corAcento: "#C9A227",     // dourado — botões, destaques

  // Caminho da logo (aparece na tela de login, se preenchido)
  logoUrl: "", // ex: "logo.png" — deixe vazio para não exibir logo

  // Texto de rodapé opcional (ex: nome do revendedor/franqueado)
  rodape: ""
};

// Aplica a marca no carregamento da página (título, cores, textos)
(function aplicarMarca() {
  document.title = MARCA.nomeSistema;

  const style = document.createElement('style');
  style.textContent = `
    :root {
      --ink-900: ${MARCA.corPrimaria};
      --gold-500: ${MARCA.corAcento};
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-marca="nome-sistema"]').forEach(el => {
      el.textContent = MARCA.nomeSistema;
    });
    if (MARCA.logoUrl) {
      document.querySelectorAll('[data-marca="logo"]').forEach(el => {
        el.src = MARCA.logoUrl;
        el.style.display = 'block';
      });
    }
    if (MARCA.rodape) {
      document.querySelectorAll('[data-marca="rodape"]').forEach(el => {
        el.textContent = MARCA.rodape;
        el.style.display = 'block';
      });
    }
  });
})();
