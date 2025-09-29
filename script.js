// script.js
document.addEventListener('DOMContentLoaded', () => {
  // --- Configuración Global ---
  const ORGANIZATION_BASE_URL = 'https://cundinamarca-map.maps.arcgis.com';
  const AGO_ITEM_DETAILS_URL = `${ORGANIZATION_BASE_URL}/home/item.html?id=`;
  const PAGE_SIZE = 12; // tarjetas por “página” del carrusel

  // Único grupo (tema) solicitado
  const groups = [
    { id: '90544ca09e6346f9bf965d7b751a1a73', name: 'Histórico Boletines Estadísticos', icon: 'fas fa-chart-line' }
  ];

  // --- Referencias al DOM (coinciden con tu index.html y style.css) ---
  const topicsContainer = document.getElementById('topics');               // <ul> o <div> de los temas
  const currentTopicTitle = document.getElementById('currentTopicTitle');  // <h2> del tema actual
  const resultsContainer = document.getElementById('resultsContainer');    // grid de tarjetas
  const noResults = document.getElementById('noResults');                  // <p> “no hay resultados”
  const loadingEl = document.getElementById('loading');                    // spinner / texto “Cargando…”
  const searchInput = document.getElementById('searchInput');              // input de búsqueda
  const prevBtn = document.getElementById('prevButton');                   // botón carrusel <
  const nextBtn = document.getElementById('nextButton');                   // botón carrusel >

  // --- Estado ---
  let allDocuments = [];    // resultados crudos del portal
  let filteredDocs = [];    // resultados filtrados (por búsqueda)
  let pageIndex = 0;        // índice del carrusel

  // --- Utilidades ---
  const fmtDate = (epochMs) => {
    try {
      const d = new Date(epochMs);
      return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
    } catch { return ''; }
  };

  const buildThumbUrl = (item) => {
    if (item.thumbnail) {
      // Miniatura pública
      return `${ORGANIZATION_BASE_URL}/sharing/rest/content/items/${item.id}/info/${encodeURIComponent(item.thumbnail)}`;
    }
    // Fallback sencillo (ícono PDF)
    return 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/file-type-pdf.svg';
  };

  const buildDownloadUrl = (item) => {
    // Para PDFs públicos, /data devuelve el binario
    return `${ORGANIZATION_BASE_URL}/sharing/rest/content/items/${item.id}/data`;
  };

  const setLoading = (v) => loadingEl.style.display = v ? 'block' : 'none';

  // --- Render de tarjetas + carrusel ---
  function renderPage() {
    resultsContainer.innerHTML = '';

    if (!filteredDocs.length) {
      noResults.style.display = 'block';
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      return;
    }

    noResults.style.display = 'none';
    const start = pageIndex * PAGE_SIZE;
    const slice = filteredDocs.slice(start, start + PAGE_SIZE);

    slice.forEach(item => {
      const card = document.createElement('article');
      card.className = 'document-card';

      card.innerHTML = `
        <div class="thumb-wrap">
          <img class="thumb" src="${buildThumbUrl(item)}" alt="Miniatura ${item.title}">
        </div>
        <div class="doc-body">
          <h3 class="doc-title" title="${item.title}">
            <a href="${AGO_ITEM_DETAILS_URL}${item.id}" target="_blank" rel="noopener">${item.title}</a>
          </h3>
          <p class="doc-meta">Modificado: ${fmtDate(item.modified)}</p>
        </div>
        <div class="doc-actions">
          <a class="btn btn-primary" href="${AGO_ITEM_DETAILS_URL}${item.id}" target="_blank" rel="noopener">
            <i class="fas fa-external-link-alt"></i> Ver ficha
          </a>
          <a class="btn btn-outline" href="${buildDownloadUrl(item)}" target="_blank" rel="noopener">
            <i class="fas fa-download"></i> Descargar
          </a>
        </div>
      `;
      resultsContainer.appendChild(card);
    });

    // Navegación del carrusel
    const totalPages = Math.ceil(filteredDocs.length / PAGE_SIZE);
    prevBtn.style.display = totalPages > 1 ? 'block' : 'none';
    nextBtn.style.display = totalPages > 1 ? 'block' : 'none';
    prevBtn.disabled = pageIndex <= 0;
    nextBtn.disabled = pageIndex >= totalPages - 1;
  }

  function applySearch() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) {
      filteredDocs = [...allDocuments];
    } else {
      filteredDocs = allDocuments.filter(it =>
        (it.title || '').toLowerCase().includes(q) ||
        (it.snippet || '').toLowerCase().includes(q)
      );
    }
    pageIndex = 0;
    renderPage();
  }

  // --- Carga de documentos desde el portal ---
  async function loadDocuments(groupId, groupName) {
    currentTopicTitle.textContent = groupName || 'Documentos';
    setLoading(true);
    noResults.style.display = 'none';
    resultsContainer.innerHTML = '';
    allDocuments = [];
    filteredDocs = [];
    pageIndex = 0;

    try {
      // Importante: usar el buscador global + encodeURIComponent
      // Solo PDF en el grupo indicado (públicos)
      const q = `group:"${groupId}" AND type:PDF`;
      const url = `${ORGANIZATION_BASE_URL}/sharing/rest/search?f=json&num=100&sortField=modified&sortOrder=desc&q=${encodeURIComponent(q)}`;

      const resp = await fetch(url, { method: 'GET' });
      const data = await resp.json();

      allDocuments = (data.results || []).map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        snippet: r.snippet,
        thumbnail: r.thumbnail,
        modified: r.modified
      }));

      filteredDocs = [...allDocuments];
      renderPage();
    } catch (e) {
      console.error('Error consultando el portal:', e);
      noResults.style.display = 'block';
      noResults.textContent = 'Ocurrió un error consultando el portal.';
    } finally {
      setLoading(false);
    }
  }

  // --- Sidebar (temas/grupos) ---
  function renderTopics() {
    if (!topicsContainer) return;
    topicsContainer.innerHTML = '';

    groups.forEach((g, idx) => {
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'topic-link';
      a.innerHTML = `<i class="${g.icon}"></i><span>${g.name}</span>`;
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        document.querySelectorAll('.topic-link').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        loadDocuments(g.id, g.name);
      });
      topicsContainer.appendChild(a);

      // Activar el primero por defecto
      if (idx === 0) a.classList.add('active');
    });
  }

  // --- Listeners ---
  prevBtn?.addEventListener('click', () => {
    if (pageIndex > 0) {
      pageIndex -= 1;
      renderPage();
    }
  });

  nextBtn?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredDocs.length / PAGE_SIZE);
    if (pageIndex < totalPages - 1) {
      pageIndex += 1;
      renderPage();
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', applySearch);
    searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') applySearch(); });
  }

  // --- Inicio ---
  renderTopics();
  if (groups.length) {
    loadDocuments(groups[0].id, groups[0].name);
  }
});
