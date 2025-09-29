// script.js
// Centro de Documentación – Histórico Boletines Estadísticos (PDF)
// Org: https://cundinamarca-map.maps.arcgis.com
// Grupo público: 90544ca09e6346f9bf965d7b751a1a73

document.addEventListener('DOMContentLoaded', () => {
  // --- Configuración ---
  const ORG_URL = 'https://cundinamarca-map.maps.arcgis.com';
  const GLOBAL_SEARCH_URL = 'https://www.arcgis.com/sharing/rest/search';
  const GROUP_ID = '90544ca09e6346f9bf965d7b751a1a73';
  const PAGE_SIZE = 12; // tarjetas por página

  // --- Referencias DOM (coinciden con tu index.html / style.css) ---
  const topicsContainer   = document.getElementById('topics');            // menú lateral
  const currentTopicTitle = document.getElementById('currentTopicTitle'); // título del tema
  const resultsContainer  = document.getElementById('resultsContainer');  // grid de tarjetas
  const noResultsEl       = document.getElementById('noResults');         // mensaje vacío
  const loadingEl         = document.getElementById('loading');           // “cargando…”
  const searchInput       = document.getElementById('searchInput');       // búsqueda
  const prevBtn           = document.getElementById('prevButton');        // carrusel <
  const nextBtn           = document.getElementById('nextButton');        // carrusel >

  // --- Estado ---
  let allDocuments = [];
  let filteredDocs = [];
  let pageIndex = 0;

  // --- Utilidades ---
  const setLoading = (v) => { if (loadingEl) loadingEl.style.display = v ? 'block' : 'none'; };
  const fmtDate = (ms) => {
    try { return new Date(ms).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' }); }
    catch { return ''; }
  };
  const arcgisDetailsUrl  = (id) => `${ORG_URL}/home/item.html?id=${id}`;
  const arcgisDownloadUrl = (id) => `${ORG_URL}/sharing/rest/content/items/${id}/data`;
  const arcgisThumbUrl = (item) => {
    if (item.thumbnail) {
      return `${ORG_URL}/sharing/rest/content/items/${item.id}/info/${encodeURIComponent(item.thumbnail)}`;
    }
    return 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/file-type-pdf.svg'; // fallback
  };

  function iconAndType(itemType) {
    const t = (itemType || '').toLowerCase();
    if (t.includes('pdf'))           return { iconClass: 'fas fa-file-pdf',       label: 'PDF' };
    if (t.includes('powerpoint'))    return { iconClass: 'fas fa-file-powerpoint',label: 'PowerPoint' };
    if (t.includes('excel'))         return { iconClass: 'fas fa-file-excel',     label: 'Excel' };
    if (t.includes('word'))          return { iconClass: 'fas fa-file-word',      label: 'Word' };
    if (t.includes('csv'))           return { iconClass: 'fas fa-file-csv',       label: 'CSV' };
    if (t.includes('image'))         return { iconClass: 'fas fa-image',          label: 'Imagen' };
    return { iconClass: 'fas fa-file', label: 'Documento' };
  }

  // --- Render tarjetas ---
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

    pageItems.forEach(doc => {
      const fileInfo = iconAndType(doc.type);
      const thumb = arcgisThumbUrl(doc);
      const detailsUrl = arcgisDetailsUrl(doc.id);
      const downloadUrl = arcgisDownloadUrl(doc.id);

      const card = document.createElement('div');
      card.className = 'document-card';

      card.innerHTML = `
        <div class="document-card-image-wrapper">
          <img src="${thumb}" alt="Miniatura de ${doc.title || 'Documento'}" class="document-card-thumbnail">
        </div>

        <div class="document-card-content">
          <h3>${doc.title || 'Título Desconocido'}</h3>
          <div class="file-info">
            <i class="${fileInfo.iconClass}"></i>
            ${fileInfo.label} — ${fmtDate(doc.modified) || 'N/D'}
          </div>
          <p class="description">${doc.snippet || doc.description || 'Sin descripción disponible.'}</p>

          <div class="document-card-actions">
            <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" class="download-button">Descargar</a>
            <a href="${detailsUrl}"  target="_blank" rel="noopener noreferrer" class="details-button">Ver Detalles</a>
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

  // --- REST helpers ---
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

  // Preferimos el buscador global de ArcGIS (más tolerante)
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

  // Fallback: contenido del grupo en la org
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

  // --- Carga principal ---
  async function loadDocuments() {
    currentTopicTitle.textContent = 'Histórico Boletines Estadísticos';
    setLoading(true);
    resultsContainer.innerHTML = '';
    noResultsEl.style.display = 'none';
    pageIndex = 0;
    allDocuments = [];
    filteredDocs = [];

    try {
      let results = await searchByGlobal(GROUP_ID);
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

  // --- Menú lateral (un único tema en esta app) ---
  function renderTopics() {
    if (!topicsContainer) return;
    topicsContainer.innerHTML = '';
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'active'; // tu CSS usa .active para resaltar
    link.innerHTML = `<i class="fas fa-chart-line"></i><span>Histórico Boletines Estadísticos</span>`;
    link.addEventListener('click', (e) => { e.preventDefault(); loadDocuments(); });
    topicsContainer.appendChild(link);
  }

  // --- Eventos UI ---
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
