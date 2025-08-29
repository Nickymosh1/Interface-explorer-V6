import { state, saveFavorites } from './state.js';
import { escapeHtml, highlightSearchTerms } from './utils.js';

// A central cache for frequently accessed DOM elements.
export const DOMElements = {};

export function cacheDOMElements() {
    const ids = [
        'searchInput', 'searchSuggestions', 'interfaceList', 'welcomeMessage', 'detailsContent',
        'fillFormBtn', 'rejectionCodesBtn', 'rejectionCodesPanel', 'closeRejectionCodes',
        'rejectionCodeSearch', 'rejectionCodesList', 'formBuilderPanel', 'closeFormBuilder',
        'formInterfaceName', 'senderName', 'senderContact', 'receiverName', 'receiverContact',
        'formContent', 'exportFormBtn', 'loading-indicator'
    ];
    
    // Helper function to convert kebab-case (like 'loading-indicator') to camelCase (like 'loadingIndicator')
    const toCamelCase = (str) => str.replace(/-(\w)/g, (_, c) => c.toUpperCase());

    ids.forEach(id => {
        const camelCaseId = toCamelCase(id);
        DOMElements[camelCaseId] = document.getElementById(id);
    });
    
    DOMElements.filterButtons = document.querySelectorAll('.filter-btn');
    DOMElements.interfaceCardTemplate = document.getElementById('interface-card-template');
}

export function showLoading() {
    // This will now work because cacheDOMElements creates DOMElements.loadingIndicator
    if (DOMElements.loadingIndicator) {
        DOMElements.loadingIndicator.style.display = 'flex';
    }
}

export function hideLoading() {
    if (DOMElements.loadingIndicator) {
        DOMElements.loadingIndicator.style.display = 'none';
    }
}

// Renders the list of interfaces based on the current filters and search term.
export function renderInterfaceList() {
    const { interfaceList, interfaceCardTemplate } = DOMElements;
    
    if (!interfaceList || !interfaceCardTemplate) return;

    if (state.filteredInterfaces.length === 0) {
        interfaceList.innerHTML = `<div class="text-center text-[var(--purple)] opacity-80 p-4 bg-[var(--birch)] rounded-2xl">
            <p class="text-base font-medium">No interfaces found</p>
            <p class="text-xs opacity-70">Try different search terms or filters</p>
        </div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    const typeClasses = {
        supplier_send: 'border-send',
        supplier_receive: 'border-receive',
        supplier_both: 'border-both',
        none: 'border-none'
    };

    state.filteredInterfaces.forEach(item => {
        const clone = interfaceCardTemplate.content.cloneNode(true);
        const card = clone.querySelector('.interface-card');
        
        card.dataset.id = item.id;
        card.classList.add(typeClasses[item.supplier_type]);
        
        if (state.favorites.has(item.id)) {
            card.classList.add('favorite');
        }

        card.querySelector('[data-role="id"]').innerHTML = highlightSearchTerms(item.id, state.currentSearchTerm);
        card.querySelector('[data-role="name"]').innerHTML = highlightSearchTerms(item.name, state.currentSearchTerm);

        fragment.appendChild(clone);
    });

    interfaceList.innerHTML = '';
    interfaceList.appendChild(fragment);
}

// Toggles an interface's favorite status and re-renders the list.
export function toggleFavorite(id) {
    if (state.favorites.has(id)) {
        state.favorites.delete(id);
    } else {
        state.favorites.add(id);
    }
    saveFavorites();
    renderInterfaceList(); // Re-render to show updated favorite status
    
    // Also update the button in the details view if it's visible
    const favoriteButton = DOMElements.detailsContent.querySelector(`[data-action="toggle-favorite"][data-id="${id}"]`);
    if(favoriteButton) {
        const isFavorite = state.favorites.has(id);
        favoriteButton.textContent = isFavorite ? '★' : '☆';
        favoriteButton.classList.toggle('text-[var(--data-sun)]', isFavorite);
        favoriteButton.classList.toggle('text-gray-400', !isFavorite);
    }
}


// Renders the detailed view for a selected interface.
export function renderInterfaceDetails(id) {
    const item = state.interfaces.find(i => i.id === id);
    if (!item) return;

    state.currentInterfaceId = id;
    DOMElements.fillFormBtn.disabled = false;
    
    hideRejectionCodes();
    hideFormBuilder();
    DOMElements.welcomeMessage.classList.add('hidden');
    DOMElements.detailsContent.classList.remove('hidden');
    DOMElements.detailsContent.classList.add('details-fade-in');
    setTimeout(() => DOMElements.detailsContent.classList.remove('details-fade-in'), 500);

    const typeInfo = {
        supplier_send: { label: 'Supplier Send', classes: 'bg-gradient-to-r from-[var(--data-gas-off)] to-purple-600 text-white' },
        supplier_receive: { label: 'Supplier Receive', classes: 'bg-gradient-to-r from-[var(--data-sun)] to-yellow-400 text-[var(--dark-purple)]' },
        supplier_both: { label: 'Supplier Send & Receive', classes: 'bg-gradient-to-r from-[var(--data-leaf)] to-green-400 text-[var(--dark-purple)]' },
        none: { label: 'Supplier Not Involved', classes: 'bg-gradient-to-r from-gray-500 to-gray-600 text-white' }
    };

    const isFavorite = state.favorites.has(id);
    const dataItemsHtml = generateDataItemsHtml(item);
    const rejectionCodesHtml = generateRejectionCodesHtml(item);

    DOMElements.detailsContent.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div class="flex-1">
                <div class="flex items-center gap-3 mb-1">
                    <h2 class="text-2xl lg:text-3xl font-bold text-[var(--dark-purple)] leading-tight" tabindex="-1">${escapeHtml(item.name)}</h2>
                    <button data-action="toggle-favorite" data-id="${id}" class="text-2xl ${isFavorite ? 'text-[var(--data-sun)]' : 'text-gray-400'} hover:scale-110 transition-transform" title="${isFavorite ? 'Remove from' : 'Add to'} favorites">
                        ${isFavorite ? '★' : '☆'}
                    </button>
                </div>
                <p class="text-base lg:text-lg text-[var(--purple)] opacity-90 font-medium">${escapeHtml(item.id)}</p>
            </div>
            <span class="text-xs font-semibold px-4 py-2 rounded-full shadow-md ${typeInfo[item.supplier_type].classes} whitespace-nowrap">${escapeHtml(typeInfo[item.supplier_type].label)}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
            <div class="bg-white/50 p-4 sm:p-5 rounded-2xl shadow-lg border border-gray-100">
                <h4 class="font-bold text-[var(--eon-red)] text-xs mb-2 uppercase tracking-wider">FROM</h4>
                <p class="font-semibold text-[var(--dark-purple)] text-sm md:text-base leading-relaxed">${escapeHtml(item.sender) || 'N/A'}</p>
            </div>
            <div class="bg-white/50 p-4 sm:p-5 rounded-2xl shadow-lg border border-gray-100">
                <h4 class="font-bold text-[var(--eon-red)] text-xs mb-2 uppercase tracking-wider">TO</h4>
                <p class="font-semibold text-[var(--dark-purple)] text-sm md:text-base leading-relaxed">${escapeHtml(item.receiver) || 'N/A'}</p>
            </div>
        </div>
        <div class="bg-white/50 rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100">
            <h3 class="text-xl font-bold text-[var(--eon-red)] mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Context & Purpose
            </h3>
            <p class="text-[var(--dark-purple)] leading-relaxed text-sm md:text-base">${escapeHtml(item.context || "No context available.")}</p>
        </div>
        ${dataItemsHtml}
        ${rejectionCodesHtml}`;
    
    DOMElements.detailsContent.querySelector('h2').focus({ preventScroll: true });
}

function generateDataItemsHtml(interfaceItem) {
    if (!interfaceItem.composition || interfaceItem.composition.length === 0) return '';
    const tableContent = interfaceItem.composition.map(comp => {
        const itemsToRender = (comp.type === 'block' && state.dataBlocksCatalogue[comp.id]) ?
                              state.dataBlocksCatalogue[comp.id].items :
                              (comp.type === 'item' ? [comp.id] : []);
        let blockHtml = '';
        if (comp.type === 'header') {
            return `<thead class="text-xs text-[var(--dark-purple)] uppercase bg-[var(--birch)]/70 sticky top-0 z-10"><tr class="border-b"><th colspan="6" class="px-4 py-2 font-bold">${escapeHtml(comp.title)}</th></tr></thead>`;
        }
        if (comp.type === 'block') {
             const block = state.dataBlocksCatalogue[comp.id];
             if (!block) return '';
             blockHtml = `<thead class="text-xs text-[var(--dark-purple)] uppercase bg-[var(--birch)]/70 sticky top-0 z-10"><tr class="border-b"><th colspan="6" class="px-4 py-2 font-bold">${escapeHtml(comp.titleOverride || block.title)}</th></tr></thead>
                      <thead class="text-xs text-[var(--purple)] uppercase bg-[var(--birch)]/70 sticky top-9 z-10"><tr class="border-b"><th class="px-4 py-2">ID</th><th class="px-4 py-2">Data Item</th><th class="px-4 py-2 whitespace-nowrap">M/O/C</th><th class="px-4 py-2 w-1/4">Description / Rule</th><th class="px-4 py-2 w-1/4">Population Notes</th><th class="px-4 py-2">Example</th></tr></thead>`;
        }
        const rowsHtml = itemsToRender.map(itemId => {
            const di = state.dataItemsCatalogue[itemId];
            if (!di) return '';
            const notesHtml = di.populationNotes ? `<p class="text-[var(--purple)] opacity-90 whitespace-pre-wrap">${escapeHtml(di.populationNotes)}</p>` : '';
            const exampleHtml = di.example ? `<code class="text-blue-600 bg-blue-50 p-1 rounded-md text-xs">${escapeHtml(di.example)}</code>` : '';
            return `<tr class="hover:bg-gray-50/50"><td class="px-4 py-3 font-mono font-semibold text-xs align-top">${escapeHtml(itemId)}</td><td class="px-4 py-3 align-top">${escapeHtml(di.name)}</td><td class="px-4 py-3 font-semibold text-center align-top">${escapeHtml(di.cmo)}</td><td class="px-4 py-3 text-xs opacity-80 align-top">${escapeHtml(di.rule)}</td><td class="px-4 py-3 text-xs align-top">${notesHtml}</td><td class="px-4 py-3 text-xs align-top">${exampleHtml}</td></tr>`;
        }).join('');
        return blockHtml + `<tbody class="divide-y divide-gray-200/50">${rowsHtml}</tbody>`;
      }).join('');
      return `<div class="bg-white/50 rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100 mt-6 md:mt-8"><h3 class="text-xl font-bold text-[var(--eon-red)] mb-4 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>Data Items</h3><div class="overflow-auto max-h-[80vh] pr-2"><table class="w-full text-sm text-left">${tableContent}</table></div></div>`;
}

function generateRejectionCodesHtml(interfaceItem) {
    if (!interfaceItem.rejectionCodeIds || interfaceItem.rejectionCodeIds.length === 0) return '';
    const codesHtml = interfaceItem.rejectionCodeIds.map(codeId => {
        const code = state.rejectionCodesCatalogue[codeId];
        if (!code) return '';
        return `<div class="p-4 bg-red-50/50 border-l-4 border-red-400 rounded-r-lg"><p class="font-bold font-mono text-base text-red-800">${escapeHtml(codeId)}</p><p class="mt-1 text-sm font-semibold text-[var(--dark-purple)]">${escapeHtml(code.description)}</p>${code.reason ? `<p class="mt-2 text-xs text-gray-700"><b class="font-medium">Why:</b> ${escapeHtml(code.reason)}</p>` : ''}${code.resolution ? `<p class="mt-2 text-xs text-gray-700"><b class="font-medium text-green-900">How to Fix:</b> ${escapeHtml(code.resolution)}</p>` : ''}</div>`;
    }).join('');
    return `<div class="bg-white/50 rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100 mt-6 md:mt-8"><h3 class="text-xl font-bold text-[var(--eon-red)] mb-4 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>Applicable Rejection Codes</h3><div class="space-y-4">${codesHtml}</div></div>`;
}

export function showRejectionCodes() {
    DOMElements.welcomeMessage.classList.add('hidden');
    DOMElements.detailsContent.classList.add('hidden');
    DOMElements.formBuilderPanel.classList.add('hidden');
    DOMElements.rejectionCodesPanel.classList.remove('hidden');
    renderRejectionCodesList(Object.entries(state.rejectionCodesCatalogue));
}

export function hideRejectionCodes() {
    DOMElements.rejectionCodesPanel.classList.add('hidden');
    if (!state.currentInterfaceId) {
        DOMElements.welcomeMessage.classList.remove('hidden');
    } else {
        DOMElements.detailsContent.classList.remove('hidden');
    }
}

export function renderRejectionCodesList(codes) {
    if (codes.length === 0) {
        DOMElements.rejectionCodesList.innerHTML = `<div class="text-center text-[var(--purple)] opacity-80 p-8"><p class="text-base font-medium">No rejection codes found</p><p class="text-sm opacity-70">Try a different search term</p></div>`;
        return;
    }
    const html = codes.map(([codeId, code]) => `<div class="rejection-code-card p-4 bg-white rounded-2xl shadow-lg border border-gray-100"><div class="flex items-start gap-4"><div class="flex-shrink-0"><span class="inline-block px-3 py-1 bg-red-100 text-red-800 font-mono font-bold text-sm rounded-lg">${escapeHtml(codeId)}</span></div><div class="flex-1"><h3 class="font-bold text-[var(--dark-purple)] mb-2">${escapeHtml(code.description)}</h3>${code.reason ? `<p class="text-sm text-gray-700 mb-2"><span class="font-medium text-red-700">Reason:</span> ${escapeHtml(code.reason)}</p>` : ''}${code.resolution ? `<p class="text-sm text-gray-700"><span class="font-medium text-green-700">Resolution:</span> ${escapeHtml(code.resolution)}</p>` : ''}</div></div></div>`).join('');
    DOMElements.rejectionCodesList.innerHTML = html;
}

export function hideFormBuilder() {
    DOMElements.formBuilderPanel.classList.add('hidden');
    if (!state.currentInterfaceId) {
        DOMElements.welcomeMessage.classList.remove('hidden');
    } else {
        DOMElements.detailsContent.classList.remove('hidden');
    }
}

export function renderSearchSuggestions(suggestions) {
    if (suggestions.length === 0) {
        DOMElements.searchSuggestions.classList.add('hidden');
        return;
    }

    const html = suggestions.map(suggestion =>
        `<div class="p-2 hover:bg-gray-50 cursor-pointer text-sm" data-suggestion="${escapeHtml(suggestion)}">${escapeHtml(suggestion)}</div>`
    ).join('');

    DOMElements.searchSuggestions.innerHTML = html;
    DOMElements.searchSuggestions.classList.remove('hidden');
}

export function hideSearchSuggestions() {
    // Hide after a short delay to allow click events to register first
    setTimeout(() => {
        if (DOMElements.searchSuggestions) {
            DOMElements.searchSuggestions.classList.add('hidden');
        }
    }, 200);
}
