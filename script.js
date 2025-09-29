document.addEventListener('DOMContentLoaded', () => {
    // --- Configuración Global ---
    const ORGANIZATION_BASE_URL = 'https://cundinamarca-map.maps.arcgis.com/';
    const AGO_GROUP_SEARCH_SUFFIX = '/sharing/rest/content/groups/';
    const AGO_ITEM_DATA_SUFFIX = '/sharing/rest/content/items/';
    const AGO_ITEM_DETAILS_URL = `${ORGANIZATION_BASE_URL}/home/item.html?id=`;

    // Define tus grupos con sus IDs, nombres y un ícono de Font Awesome
    const groups = [
        { id: 'e315c46bba3645899d08401914067a4a', name: 'Boletines', icon: 'fas fa-chart-line' }
        
    ];

    // --- Referencias a Elementos del DOM ---
    const topicList = document.getElementById('topic-list');
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const loadingIndicator = document.getElementById('loading');
    const noResultsMessage = document.getElementById('noResults');
    const currentTopicTitle = document.getElementById('currentTopicTitle');

    // Botones del carrusel (ocultos por CSS)
    const carousel = document.getElementById('resultsContainer');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');

    // --- Variables de Estado ---
    let currentGroupId = null;
    let allDocuments = [];

    // --- Funciones de Utilidad y UI ---

    function toggleLoading(show) {
        loadingIndicator.style.display = show ? 'block' : 'none';
        noResultsMessage.style.display = 'none';
        resultsContainer.innerHTML = '';
        if (prevButton) prevButton.style.display = 'none';
        if (nextButton) nextButton.style.display = 'none';
    }

    function showNoResults() {
        noResultsMessage.style.display = 'block';
        loadingIndicator.style.display = 'none';
        resultsContainer.innerHTML = '';
        if (prevButton) prevButton.style.display = 'none';
        if (nextButton) nextButton.style.display = 'none';
    }

    function resetSearchResultsDisplay() {
        resultsContainer.innerHTML = '';
        noResultsMessage.style.display = 'none';
        allDocuments = [];
        if (prevButton) prevButton.style.display = 'none';
        if (nextButton) nextButton.style.display = 'none';
    }

    /**
     * Helper para obtener el ícono y nombre de tipo de archivo.
     * @param {string} type - El tipo de ítem de ArcGIS.
     * @returns {object} { iconClass: string, typeName: string }
     */
    function getFileTypeInfo(type) {
        let iconClass = 'fas fa-file'; // Icono por defecto
        let typeName = 'Documento';

        if (type.includes('PDF')) {
            iconClass = 'fas fa-file-pdf';
            typeName = 'PDF';
        } else if (type.includes('Word')) {
            iconClass = 'fas fa-file-word';
            typeName = 'Word';
        } else if (type.includes('Excel')) {
            iconClass = 'fas fa-file-excel';
            typeName = 'Excel';
        } else if (type.includes('PowerPoint')) {
            iconClass = 'fas fa-file-powerpoint';
            typeName = 'PowerPoint';
        } else if (type.includes('Image')) {
            iconClass = 'fas fa-image';
            typeName = 'Imagen';
        } else if (type.includes('CSV')) {
            iconClass = 'fas fa-file-csv';
            typeName = 'CSV';
        } else if (type.includes('Web Map') || type.includes('Web Scene')) {
            iconClass = 'fas fa-globe';
            typeName = 'Mapa Web';
        } else if (type.includes('Layer Package') || type.includes('Feature Service') || type.includes('Map Service')) {
            iconClass = 'fas fa-layer-group';
            typeName = 'Capa GIS';
        }
        return { iconClass, typeName };
    }

    /**
     * Helper para formatear el tamaño del archivo.
     * @param {number} sizeInBytes - Tamaño del archivo en bytes.
     * @returns {string} Tamaño formateado (ej. 1.2 MB) o "N/D" si no es un número válido.
     */
    function formatFileSize(sizeInBytes) {
        // CAMBIO CLAVE: Asegurarse de que sizeInBytes es un número antes de procesar
        if (typeof sizeInBytes !== 'number' || isNaN(sizeInBytes) || sizeInBytes < 0) {
            return 'N/D'; // Retorna "No Disponible" si el tamaño no es válido
        }
        if (sizeInBytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = 2; // Decimales
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(sizeInBytes) / Math.log(k));
        return parseFloat((sizeInBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * Renderiza los documentos en la interfaz de usuario con el formato de tarjeta horizontal.
     * @param {Array} documents - Un array de objetos documento obtenidos de la API de ArcGIS.
     */
    function displayDocuments(documents) {
        resultsContainer.innerHTML = '';

        if (documents.length === 0) {
            showNoResults();
            return;
        }

        noResultsMessage.style.display = 'none';

        documents.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'document-card';

            // Usar la imagen original de 300x200 para el placeholder si no hay miniatura
            const thumbnailUrl = doc.thumbnail 
                ? `${ORGANIZATION_BASE_URL}/sharing/rest/content/items/${doc.id}/info/${doc.thumbnail}` 
                : 'https://via.placeholder.com/300x200?text=No+Preview'; 
            
            const downloadUrl = `${ORGANIZATION_BASE_URL}${AGO_ITEM_DATA_SUFFIX}${doc.id}/data`;
            
            const canOpenDetails = doc.type === 'PDF' || doc.type.includes('Document Link') || doc.type === 'URL';

            // Obtener información del tipo de archivo y tamaño
            const fileInfo = getFileTypeInfo(doc.type);
            const fileSize = formatFileSize(doc.size); // Pasar directamente doc.size, la función lo validará

            card.innerHTML = `
                <div class="document-card-image-wrapper">
                    <img src="${thumbnailUrl}" alt="Miniatura de ${doc.title || 'Documento'}" class="document-card-thumbnail">
                </div>
                <div class="document-card-content">
                    <h3>${doc.title || 'Título Desconocido'}</h3>
                    <div class="file-info">
                        <i class="${fileInfo.iconClass}"></i> 
                        <span>${fileInfo.typeName} - ${fileSize}</span>
                    </div>
                    <p class="description">${doc.snippet || doc.description || 'Sin descripción disponible.'}</p>
                    <div class="document-card-actions">
                        <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" class="download-button">Descargar</a>
                        ${canOpenDetails ? `<a href="${AGO_ITEM_DETAILS_URL}${doc.id}" target="_blank" rel="noopener noreferrer" class="details-button">Ver Detalles</a>` : ''}
                    </div>
                </div>
            `;
            resultsContainer.appendChild(card);
        });

        updateCarouselButtons();
    }

    // --- Lógica Principal: Carga y Búsqueda de Documentos ---

    async function loadDocuments(groupId, groupName) {
        currentGroupId = groupId;
        currentTopicTitle.textContent = groupName;
        toggleLoading(true);
        
        try {
            const url = `${ORGANIZATION_BASE_URL}${AGO_GROUP_SEARCH_SUFFIX}${groupId}/search?f=json&num=100&sortField=modified&sortOrder=desc&q=type:("PDF" OR "Microsoft Word" OR "Microsoft Excel" OR "Microsoft PowerPoint" OR "CSV" OR "Image" OR "XML" OR "Geodatabase" OR "Feature Service" OR "Map Service" OR "Layer Package" OR "Web Map" OR "Web Scene")`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }
            const data = await response.json();
            
            allDocuments = data.results || []; 

            toggleLoading(false);
            displayDocuments(allDocuments);

        } catch (error) {
            console.error('Error al cargar documentos:', error);
            toggleLoading(false);
            resultsContainer.innerHTML = `<p class="no-results">¡Lo sentimos! Hubo un error al cargar los documentos de este tema. Por favor, intenta de nuevo.</p>`;
        }
    }

    function performSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();

        if (!searchTerm && currentGroupId) {
            const currentGroup = groups.find(g => g.id === currentGroupId);
            if (currentGroup) {
                loadDocuments(currentGroup.id, currentGroup.name);
            }
            return;
        } else if (!searchTerm) {
            return;
        }

        const filteredDocs = allDocuments.filter(doc =>
            (doc.title && doc.title.toLowerCase().includes(searchTerm)) ||
            (doc.snippet && doc.snippet.toLowerCase().includes(searchTerm)) ||
            (doc.description && doc.description.toLowerCase().includes(searchTerm)) ||
            (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
        
        displayDocuments(filteredDocs);
    }

    // --- Carrusel de Documentos Funcionalidad (deshabilitada por CSS) ---
    const updateCarouselButtons = () => {
        // No hace nada, los botones se ocultan por CSS.
    };

    // --- Inicialización y Manejo de Eventos ---

    // 1. Crea dinámicamente los elementos del menú lateral (li > a)
    groups.forEach(group => {
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'topic-link';
        link.innerHTML = `<i class="${group.icon}"></i> ${group.name}`;
        
        link.addEventListener('click', (event) => {
            event.preventDefault();
            document.querySelectorAll('.topic-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            loadDocuments(group.id, group.name);
            searchInput.value = '';
        });
        listItem.appendChild(link);
        topicList.appendChild(listItem);
    });

    // 2. Asigna el evento 'input' y 'keyup' al campo de búsqueda
    searchInput.addEventListener('input', performSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    // 3. Carga los documentos del primer grupo por defecto al cargar la página
    if (groups.length > 0) {
        document.querySelector('.topic-link').classList.add('active');
        loadDocuments(groups[0].id, groups[0].name);
    }

    // 4. No necesitamos listeners de redimensionamiento para el carrusel
});