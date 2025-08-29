
import { state, loadFavorites } from './state.js';
import { fetchData } from './api.js';
import {
    DOMElements,
    cacheDOMElements,
    renderInterfaceList,
    renderInterfaceDetails,
    toggleFavorite,
    showRejectionCodes,
    hideRejectionCodes,
    hideFormBuilder,
    renderRejectionCodesList,
    showLoading,
    hideLoading,
    renderSearchSuggestions,
    hideSearchSuggestions
} from './ui.js';
import { showFormBuilder, exportFormData } from './formBuilder.js';
import { fuzzySearch, generateSearchSuggestions } from './utils.js';

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    cacheDOMElements(); 
    showLoading(); 
    loadFavorites();

    const data = await fetchData('interfaceData.json');
    if (!data) {
        DOMElements.interfaceList.innerHTML = `<p class="text-center text-red-600 p-4">Error: Could not load interface data. Please refresh the page.</p>`;
        hideLoading();
        return;
    }

    Object.assign(state, data, { filteredInterfaces: data.interfaces || [] });

    setupEventListeners();
    
    const params = new URLSearchParams(window.location.search);
    const initialSearch = params.get('search') || '';
    const initialFilter = params.get('filter') || 'all';
    const initialSelected = params.get('selected');

    if (initialSearch) {
        DOMElements.searchInput.value = initialSearch;
        state.currentSearchTerm = initialSearch;
    }
    if (initialFilter) {
        state.currentFilter = initialFilter;
        document.querySelector(`.filter-btn.active-filter`)?.classList.remove('active-filter');
        document.querySelector(`.filter-btn[data-filter="${initialFilter}"]`)?.classList.add('active-filter');
    }

    filterAndRender();

    if (initialSelected && state.interfaces.some(i => i.id === initialSelected)) {
        renderInterfaceDetails(initialSelected);
    }
    
    hideLoading();
}

function setupEventListeners() {
    let debounceTimer;
    
    // --- UPDATED SEARCH LOGIC ---
    const handleSearch = () => {
        state.currentSearchTerm = DOMElements.searchInput.value;
        const suggestions = generateSearchSuggestions(state.currentSearchTerm, state.interfaces);
        renderSearchSuggestions(suggestions);
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(filterAndRender, 200);
    };

    DOMElements.searchInput.addEventListener('input', handleSearch);
    DOMElements.searchInput.addEventListener('focus', handleSearch);
    DOMElements.searchInput.addEventListener('blur', hideSearchSuggestions);

    DOMElements.searchSuggestions.addEventListener('click', e => {
        const suggestionEl = e.target.closest('[data-suggestion]');
        if (suggestionEl) {
            DOMElements.searchInput.value = suggestionEl.dataset.suggestion;
            state.currentSearchTerm = suggestionEl.dataset.suggestion;
            hideSearchSuggestions();
            filterAndRender();
        }
    });
    // --- END OF UPDATED SEARCH LOGIC ---

    DOMElements.filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            state.currentFilter = button.dataset.filter;
            DOMElements.filterButtons.forEach(btn => btn.classList.remove('active-filter'));
            button.classList.add('active-filter');
            filterAndRender();
        });
    });

    DOMElements.interfaceList.addEventListener('click', e => {
        const card = e.target.closest('[data-id]');
        if (card) {
            renderInterfaceDetails(card.dataset.id);
        }
    });

    DOMElements.detailsContent.addEventListener('click', e => {
        const favoriteButton = e.target.closest('[data-action="toggle-favorite"]');
        if (favoriteButton) {
            toggleFavorite(favoriteButton.dataset.id);
        }
    });

    DOMElements.rejectionCodesBtn.addEventListener('click', showRejectionCodes);
    DOMElements.closeRejectionCodes.addEventListener('click', hideRejectionCodes);
    
    DOMElements.fillFormBtn.addEventListener('click', showFormBuilder);
    DOMElements.closeFormBuilder.addEventListener('click', hideFormBuilder);
    DOMElements.exportFormBtn.addEventListener('click', exportFormData);
    
    DOMElements.rejectionCodeSearch.addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = Object.entries(state.rejectionCodesCatalogue).filter(([id, code]) => 
            `${id} ${code.description} ${code.reason} ${code.resolution}`.toLowerCase().includes(searchTerm)
        );
        renderRejectionCodesList(filtered);
    });
    
    window.addEventListener('popstate', () => {
        // This can be used to handle back/forward navigation if needed in the future
    });
}

function buildSearchableContent(item) {
    let content = [item.id, item.name, item.description, item.sender, item.receiver, item.context].join(' ');
    if (item.composition) {
        item.composition.forEach(comp => {
            const items = (comp.type === 'block' && state.dataBlocksCatalogue[comp.id]) ?
                          state.dataBlocksCatalogue[comp.id].items : (comp.type === 'item' ? [comp.id] : []);
            items.forEach(itemId => {
                const di = state.dataItemsCatalogue[itemId];
                if (di) content += ` ${itemId} ${di.name} ${di.rule}`;
            });
        });
    }
    return content.toLowerCase();
}

function filterAndRender() {
    const searchTerms = state.currentSearchTerm.toLowerCase().split(' ').filter(term => term.trim());
    
    state.filteredInterfaces = state.interfaces.filter(item => {
        const matchesFilter = state.currentFilter === 'all' ||
            item.supplier_type === state.currentFilter ||
            (state.currentFilter === 'supplier_send' && item.supplier_type === 'supplier_both') ||
            (state.currentFilter === 'supplier_receive' && item.supplier_type === 'supplier_both');
        
        if (!matchesFilter) return false;
        if (searchTerms.length === 0) return true;

        const content = buildSearchableContent(item);
        return searchTerms.some(term => fuzzySearch(term, content, 0.3).matches);
    });
    
    if (state.currentSearchTerm) {
        state.filteredInterfaces.sort((a, b) => {
            const aScore = fuzzySearch(state.currentSearchTerm, buildSearchableContent(a)).score;
            const bScore = fuzzySearch(state.currentSearchTerm, buildSearchableContent(b)).score;
            return bScore - aScore;
        });
    }

    renderInterfaceList();
    updateURL();
}

function updateURL() {
    const params = new URLSearchParams();
    if (state.currentSearchTerm) params.set('search', state.currentSearchTerm);
    if (state.currentFilter !== 'all') params.set('filter', state.currentFilter);
    if (state.currentInterfaceId && !DOMElements.detailsContent.classList.contains('hidden')) {
        params.set('selected', state.currentInterfaceId);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
}
