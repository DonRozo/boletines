// script.js
// Centro de Documentación – Histórico Boletines Estadísticos (PDF)
// Org: https://cundinamarca-map.maps.arcgis.com
// Grupo: 90544ca09e6346f9bf965d7b751a1a73

document.addEventListener('DOMContentLoaded', () => {
  // --- Configuración ---
  const ORG_URL = 'https://cundinamarca-map.maps.arcgis.com';
  const GLOBAL_SEARCH_URL = 'https://www.arcgis.com/sharing/rest/search';
  const GROUP_ID = '90544ca09e6346f9bf965d7b751a1a73';
  const PAGE_SIZE = 12; // número de tarjetas por “página”

  // --- Referencias DOM (deben existir en tu index.html) ---
  const topicsContainer     = document.getElementById('topics');               // contenedor del menú lateral
  const currentTopicTitle   = document.getElementById('currentTopicTitle');    // título del tema
  const resultsContainer    = document.getElementById('resultsContainer');     // grid de tarjetas
  const noResultsEl         = document.getElementById('noResults');            // mensaje sin resultados
  const loadingEl           = document.getElementById('loading');              // indicador “cargando…”
  const searchInput         = document.getElementById('searchInput');          // caja de búsqueda
  const prevBtn             = document.getElementById('prevButton');           // botón carrusel <
  const nextBtn             = document.getElementById('nextButton');           // botón carrusel >

  // --- Estado ---
  let allDocuments = [];   // resultados crudos
  let filteredDocs = [];   // resultados filtrados por búsqueda
  let pageIndex    = 0;    // índice de página del carrusel

  // --- Utilidades ---
  const setLoading = (v) => { loadingEl.style.display = v ? 'block' : 'none'; };
  const fmtDate = (ms) => {
    try { return new Date(ms).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' }); }
    catch { return ''; }
  };
  const detailsUrl  = (id) => `${ORG_URL}/home/item.html?id=${id}`;
  const downloadUrl = (id) => `${ORG_URL}/sharing/rest/content/items/${id}/data`;
  const thumbUrl = (item) => {
    if (item.thumbnail) {
      return `${ORG_URL}/sharing/rest/content/items/${item.id}/info/${encodeURIComponent(item.thumbnail)}`;
    }
    // Ícono genérico PDF si el ítem no tiene thumbnail
    return 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/file-type-pdf.svg';
  };

  // --- Render de tarjetas y navegación ---
  function renderPage() {
    resultsContainer.innerHTML = '';

    if (!filteredDocs.length) {
      noResultsEl.style.display = 'block';
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      return;
    }

    noResultsEl.style.display = 'none';

    const start = pageIndex * PAGE_SIZE;
    const pageItems = filteredDocs.slice(start, start + PAGE_SIZE);

    pageItems.forEach(item => {
      const card = document.createElement('article');
      card.className = 'document-card';
      card.innerHTML = `
        <div class="thumb-wrap">
          <img class="thumb" src="${thumbUrl(item)}" alt="Miniatura ${item.title}">
        </div>
        <div class="doc-body">
          <h3 class="doc-title" title="${item.title}">
            <a href="${detailsUrl(item.id)}" target="_blank" rel="noopener">${item.title}</a>
          </h3>
          <p class="doc-meta">Modificado: ${fmtDate(item.modified)}</p>
        </div>
        <div class="doc-actions">
          <a class="btn btn-primary" href="${detailsUrl(item.id)}" target="_blank" rel="noopener">
            <i class="fas fa-external-link-alt"></i> Ver ficha
          </a>
          <a class="btn btn-outline" href="${downloadUrl(item.id)}" target="_blank" rel="noopener">
            <i class="fas fa-download"></i> Descargar
          </a>
        </div>
      `;
      resultsContainer.appendChild(card);
    });

    const totalPages = Math.ceil(filteredDocs.length / PAGE_SIZE);
    prevBtn.style.display = totalPages > 1 ? 'block' : 'none';
    nextBtn.style.display = totalPages > 1 ? 'block' : 'none';
    prevBtn.disabled = pageIndex <= 0;
    nextBtn.disabled = pageIndex >= totalPages - 1;
  }

  function applySearch() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    filteredDocs = !q
      ? [...allDocuments]
      : allDocuments.filter(it =>
          (it.title || '').toLowerCase().includes(q) ||
          (it.snippet || '').toLowerCase().includes(q)
        );
    pageIndex = 0;
    renderPage();
  }

  // --- Fetch helpers con diagnóstico ---
  async function fetchJSON(url) {
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error('[Fetch error]', resp.status, resp.statusText, body);
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json();
    if (data?.error) {
      console.error('[ArcGIS REST error]', data.error);
      throw new Error(data.error.message || 'Error de ArcGIS REST');
    }
    return data;
  }

  // 1) Búsqueda global (www.arcgis.com) —más tolerante a políticas de la org
  async function searchByGlobal(groupId) {
    const q = `group:"${groupId}" AND type:PDF`;
    const url = `${GLOBAL_SEARCH_URL}?f=json&num=100&sortField=modified&sortOrder=desc&q=${encodeURIComponent(q)}`;
    const data = await fetchJSON(url);
    return (data.results || []).map(r => ({
      id: r.id,
      title: r.title,
      snippet: r.snippet,
      modified: r.modified,
      thumbnail: r.thumbnail
    }));
  }

  // 2) Fallback: contenido del grupo en la propia organización
  async function searchByGroupContent(groupId) {
    const url = `${ORG_URL}/sharing/rest/content/groups/${groupId}?f=json&num=100&sortField=modified&sortOrder=desc`;
    const data = await fetchJSON(url);
    const items = data.items || [];
    return items
      .filter(it => (it.type || '').toLowerCase() === 'pdf')
      .map(r => ({
        id: r.id,
        title: r.title,
        snippet: r.snippet,
        modified: r.modified,
        thumbnail: r.thumbnail
      }));
  }

  // --- Carga principal con fallback ---
  async function loadDocuments() {
    currentTopicTitle.textContent = 'Histórico Boletines Estadísticos';
    setLoading(true);
    resultsContainer.innerHTML = '';
    noResultsEl.style.display = 'none';
    pageIndex = 0;
    allDocuments = [];
    filteredDocs = [];

    try {
      // Intento 1: buscador global
      let results = await searchByGlobal(GROUP_ID);

      // Si no devuelve nada, usar contenido del grupo
      if (!results.length) {
        console.warn('Global search devolvió 0; probando contenido del grupo…');
        results = await searchByGroupContent(GROUP_ID);
      }

      allDocuments = results;
      filteredDocs = [...allDocuments];

      if (!filteredDocs.length) {
        noResultsEl.style.display = 'block';
        noResultsEl.textContent = 'No se encontraron documentos en el grupo.';
      }

      renderPage();
    } catch (err) {
      console.error('Error consultando el portal:', err);
      noResultsEl.style.display = 'block';
      noResultsEl.textContent = 'Ocurrió un error consultando el portal.';
    } finally {
      setLoading(false);
    }
  }

  // --- Menú lateral (solo un tema fijo en esta app) ---
  function renderTopics() {
    if (!topicsContainer) return;
    topicsContainer.innerHTML = '';
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'topic-link active';
    link.innerHTML = `<i class="fas fa-chart-line"></i><span>Histórico Boletines Estadísticos</span>`;
    link.addEventListener('click', (e) => { e.preventDefault(); loadDocuments(); });
    topicsContainer.appendChild(link);
  }

  // --- Listeners UI ---
  prevBtn?.addEventListener('click', () => {
    if (pageIndex > 0) { pageIndex--; renderPage(); }
  });

  nextBtn?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredDocs.length / PAGE_SIZE);
    if (pageIndex < totalPages - 1) { pageIndex++; renderPage(); }
  });

  if (searchInput) {
    searchInput.addEventListener('input', applySearch);
    searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') applySearch(); });
  }

  // --- Inicio ---
  renderTopics();
  loadDocuments();
});
