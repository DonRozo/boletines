// script.js
// Centro de Documentación – Histórico Boletines Estadísticos (PDF)
// Org: https://cundinamarca-map.maps.arcgis.com
// Grupo público: 90544ca09e6346f9bf965d7b751a1a73
// Buscador: SOLO por título (cliente), sin acentos, multi-término (AND), con debounce.

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Configuración ----------
  const ORG_URL = 'https://cundinamarca-map.maps.arcgis.com';
  const GLOBAL_SEARCH_URL = 'https://www.arcgis.com/sharing/rest/search';
  const GROUP_ID = '90544ca09e6346f9bf965d7b751a1a73';
  const PAGE_SIZE = 12; // tarjetas por página

  // ---------- DOM ----------
  const topicsContainer   = document.getElementById('topics');            // no visible, pero mantenido para compatibilidad
  const currentTopicTitle = document.getElementById('currentTopicTitle');
  const resultsContainer  = document.getElementById('resultsContainer');
  const noResultsEl       = document.getElementById('noResults');
  const loadingEl         = document.getElementById('loading');
  const searchInput       = document.getElementById('searchInput');
  const prevBtn           = document.getElementById('prevButton');
  const nextBtn           = document.getElementById('nextButton');

  // ---------- Estado ----------
  let allDocuments = [];   // resultados crudos
  let filteredDocs = [];   // resultados filtrados
  let pageIndex    = 0;

  // ---------- Utilidades ----------
  const setLoading = (v) => { if (loadingEl) loadingEl.style.display = v ? 'block' : 'none'; };

  const fmtDate = (ms) => {
    try { return new Date(ms).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' }); }
    catch { return 'N/D'; }
  };

  const detailsUrl  = (id) => `${ORG_URL}/home/item.html?id=${id}`;
  const downloadUrl = (id) => `${ORG_URL}/sharing/rest/content/items/${id}/data`;
  const thumbUrl    = (item) =>
    item.thumbnail
      ? `${ORG_URL}/sharing/rest/content/items/${item.id}/info/${encodeURIComponent(item.thumbnail)}`
      : 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/file-type-pdf.svg';

  const fileIconAndLabel = (typeStr) => {
    const t = (typeStr || '').toLowerCase();
    if (t.includes('pdf'))        return { icon: 'fas fa-file-pdf',        label: 'PDF' };
    if (t.includes('powerpoint')) return { icon: 'fas fa-file-powerpoint', label: 'PowerPoint' };
    if (t.includes('excel'))      return { icon: 'fas fa-file-excel',      label: 'Excel' };
    if (t.includes('word'))       return { icon: 'fas fa-file-word',       label: 'Word' };
    if (t.includes('csv'))        return { icon: 'fas fa-file-csv',        label: 'CSV' };
    if (t.includes('image'))      return { icon: 'fas fa-image',           label: 'Imagen' };
    return { icon: 'fas fa-file', label: 'Documento' };
  };

  // Normaliza: minúsculas + sin acentos + trim
  const normalize = (s) =>
    (s || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Debounce (para el buscador)
  function debounce(fn, ms = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  // ---------- Render ----------
  function renderPage() {
    resultsContainer.innerHTML = '';

    if (!filteredDocs.length) {
      noResultsEl.style.display = 'block';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      return;
    }
    noResultsEl.style.display = 'none';

    const start = pageIndex * PAGE_SIZE;
    const pageItems = filteredDocs.slice(start, start + PAGE_SIZE);

    pageItems.forEach(item => {
      const { icon, label } = fileIconAndLabel(item.type);
      const card = document.createElement('div');
      card.className = 'document-card';

      card.innerHTML = `
        <div class="document-card-image-wrapper">
          <img src="${thumbUrl(item)}" alt="Miniatura de ${item.title || 'Documento'}" class="document-card-thumbnail">
        </div>

        <div class="document-card-content">
          <h3>${item.title || 'Título desconocido'}</h3>

          <div class="file-info">
            <i class="${icon}"></i>
            ${label} — ${fmtDate(item.modified)}
          </div>

          <p class="description">${item.snippet || item.description || ''}</p>

          <div class="document-card-actions">
            <a href="${downloadUrl(item.id)}" target="_blank" rel="noopener noreferrer" class="download-button">Descargar</a>
            <a href="${detailsUrl(item.id)}"  target="_blank" rel="noopener noreferrer" class="details-button">Ver Detalles</a>
          </div>
        </div>
      `;

      resultsContainer.appendChild(card);
    });

    const totalPages = Math.ceil(filteredDocs.length / PAGE_SIZE);
    if (prevBtn) {
      prevBtn.style.display = totalPages > 1 ? 'block' : 'none';
      prevBtn.disabled = pageIndex <= 0;
    }
    if (nextBtn) {
      nextBtn.style.display = totalPages > 1 ? 'block' : 'none';
      nextBtn.disabled = pageIndex >= totalPages - 1;
    }
  }

  // ---------- Búsqueda (SOLO título) ----------
  function applySearch() {
    const q = normalize(searchInput?.value);
    if (!q) {
      filteredDocs = [...allDocuments];
    } else {
      const terms = q.split(/\s+/).filter(Boolean); // varios términos (AND)
      filteredDocs = allDocuments.filter((it) => {
        const title = normalize(it.title);
        return terms.every((t) => title.includes(t));
      });
    }
    pageIndex = 0;
    renderPage();
  }

  // ---------- REST helpers ----------
  async function fetchJSON(url) {
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error('[HTTP]', resp.status, resp.statusText, body);
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
      type: r.type,
      modified: r.modified,
      thumbnail: r.thumbnail
    }));
  }

  // 2) Fallback: contenido del grupo en la org
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
        type: r.type,
        modified: r.modified,
        thumbnail: r.thumbnail
      }));
  }

  // ---------- Carga principal ----------
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

      // Si no hay nada, fallback a contenido del grupo
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

  // ---------- (Opcional) Menú lateral único ----------
  function renderTopics() {
    if (!topicsContainer) return;
    topicsContainer.innerHTML = '';
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'active';
    link.innerHTML = `<i class="fas fa-chart-line"></i><span>Histórico Boletines Estadísticos</span>`;
    link.addEventListener('click', (e) => { e.preventDefault(); loadDocuments(); });
    topicsContainer.appendChild(link);
  }

  // ---------- Listeners UI ----------
  prevBtn?.addEventListener('click', () => {
    if (pageIndex > 0) { pageIndex--; renderPage(); }
  });

  nextBtn?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredDocs.length / PAGE_SIZE);
    if (pageIndex < totalPages - 1) { pageIndex++; renderPage(); }
  });

  if (searchInput) {
    const applySearchDebounced = debounce(applySearch, 200);
    searchInput.addEventListener('input', applySearchDebounced);
    searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') applySearch(); });
  }

  // ---------- Inicio ----------
  renderTopics();
  loadDocuments();
});
