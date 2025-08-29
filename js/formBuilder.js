import { state } from './state.js';
import { escapeHtml, downloadFile, showSuccessMessage } from './utils.js';
import { DOMElements } from './ui.js';

export function showFormBuilder() {
    if (!state.currentInterfaceId) return;
    
    DOMElements.welcomeMessage.classList.add('hidden');
    DOMElements.detailsContent.classList.add('hidden');
    DOMElements.rejectionCodesPanel.classList.add('hidden');
    DOMElements.formBuilderPanel.classList.remove('hidden');
    
    generateInterfaceForm(state.currentInterfaceId);
}

function generateInterfaceForm(interfaceId) {
    const item = state.interfaces.find(i => i.id === interfaceId);
    if (!item) return;

    DOMElements.formInterfaceName.textContent = `${item.id} - ${item.name}`;
    DOMElements.senderName.value = item.sender || '';
    DOMElements.receiverName.value = item.receiver || '';

    DOMElements.formContent.innerHTML = generateFormHTML(item);
}

function generateFormHTML(interfaceItem) {
    if (!interfaceItem.composition || interfaceItem.composition.length === 0) {
        return '<p class="text-center text-[var(--purple)] opacity-80 p-8">No data items to fill for this interface.</p>';
    }
    return interfaceItem.composition.map(comp => {
        if (comp.type === 'header') {
            return `<div class="bg-[var(--birch)] p-4 rounded-xl"><h3 class="font-bold text-[var(--dark-purple)] text-lg">${escapeHtml(comp.title)}</h3></div>`;
        }
        if (comp.type === 'block' && state.dataBlocksCatalogue[comp.id]) {
            const block = state.dataBlocksCatalogue[comp.id];
            const itemsHtml = block.items.map(itemId => {
                const dataItem = state.dataItemsCatalogue[itemId];
                return dataItem ? generateDataItemInput(itemId, dataItem) : '';
            }).join('');
            return `<div class="bg-white rounded-xl p-4 border border-gray-200"><h4 class="font-bold text-[var(--eon-red)] mb-4">${escapeHtml(comp.titleOverride || block.title)}</h4><div class="grid gap-4">${itemsHtml}</div></div>`;
        }
        if (comp.type === 'item') {
            const dataItem = state.dataItemsCatalogue[comp.id];
            return dataItem ? `<div class="bg-white rounded-xl p-4 border border-gray-200">${generateDataItemInput(comp.id, dataItem)}</div>` : '';
        }
        return '';
    }).join('');
}

function generateDataItemInput(itemId, dataItem) {
    const isRequired = dataItem.cmo === 'M';
    const notes = dataItem.populationNotes?.trim() || '';
    const options = notes ? parsePopulationNotes(notes) : [];
    
    const labelClass = isRequired ? 'text-red-700 font-semibold' : 'text-[var(--purple)] font-medium';
    const requiredIndicator = isRequired ? ' <span class="text-red-500">*</span>' : '';
    
    let inputHtml;
    const inputType = determineInputType(dataItem);
    
    if (options.length > 0) {
        const optionsHtml = options.map(opt => `<option value="${escapeHtml(opt.value)}" title="${escapeHtml(opt.label)}">${escapeHtml(opt.label)}</option>`).join('');
        inputHtml = `<select class="form-input w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--eon-red)] focus:border-transparent" data-item-id="${itemId}" data-input-type="enum" ${isRequired ? 'required' : ''}><option value="">Select an option...</option>${optionsHtml}</select>`;
    } else {
        const placeholder = dataItem.example ? `e.g., ${dataItem.example}` : getPlaceholderByType(inputType);
        switch (inputType) {
            case 'date':
                inputHtml = `<input type="date" class="form-input w-full p-2 text-sm border border-gray-300 rounded-lg" data-item-id="${itemId}" data-input-type="date" ${isRequired ? 'required' : ''}>`;
                break;
            case 'datetime':
                inputHtml = `<input type="datetime-local" class="form-input w-full p-2 text-sm border border-gray-300 rounded-lg" data-item-id="${itemId}" data-input-type="datetime" ${isRequired ? 'required' : ''}>`;
                break;
            case 'number':
                inputHtml = `<input type="number" placeholder="${escapeHtml(placeholder)}" class="form-input w-full p-2 text-sm border border-gray-300 rounded-lg" data-item-id="${itemId}" data-input-type="number" ${isRequired ? 'required' : ''}>`;
                break;
            case 'textarea':
                inputHtml = `<textarea rows="3" placeholder="${escapeHtml(placeholder)}" class="form-input w-full p-2 text-sm border border-gray-300 rounded-lg" data-item-id="${itemId}" data-input-type="textarea" ${isRequired ? 'required' : ''}></textarea>`;
                break;
            default:
                inputHtml = `<input type="text" placeholder="${escapeHtml(placeholder)}" class="form-input w-full p-2 text-sm border border-gray-300 rounded-lg" data-item-id="${itemId}" data-input-type="text" ${isRequired ? 'required' : ''}>`;
        }
    }
    const validationHtml = dataItem.rule ? `<p class="text-xs text-gray-600 mt-1">${escapeHtml(dataItem.rule)}</p>` : '';
    return `<div class="form-group"><div class="flex items-start gap-3"><div class="flex-shrink-0 w-16"><code class="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">${escapeHtml(itemId)}</code></div><div class="flex-1"><label class="block text-sm ${labelClass} mb-1">${escapeHtml(dataItem.name)}${requiredIndicator} <span class="text-xs font-normal text-gray-600 ml-2">(${escapeHtml(dataItem.cmo)})</span></label>${inputHtml}${validationHtml}<div class="validation-error text-xs text-red-600 mt-1 hidden"></div></div></div></div>`;
}

// Helper functions for the form builder
function determineInputType(dataItem) {
    const name = dataItem.name.toLowerCase();
    const rule = (dataItem.rule || '').toLowerCase();
    if (/\bdate\b/.test(name) || /\btime\b/.test(name) || /\bdate\b/.test(rule) || /\btime\b/.test(rule)) return 'datetime';
    if (name.includes('number') || name.includes('quantity') || (dataItem.example && /^\d+(\.\d+)?$/.test(dataItem.example))) return 'number';
    if (name.includes('description') || name.includes('additional information')) return 'textarea';
    return 'text';
}

function getPlaceholderByType(type) {
    return { date: 'YYYY-MM-DD', datetime: 'YYYY-MM-DDTHH:mm', number: '12345', textarea: 'Enter details...' }[type] || 'Enter value...';
}

function parsePopulationNotes(notes) {
    return notes.split('\n').map(line => {
        const parts = line.split(/[-=]\s+/).map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
            return { value: parts[0], label: `${parts[0]} - ${parts.slice(1).join(' ')}` };
        }
        if (parts.length === 1 && parts[0]) {
             const singleParts = parts[0].split(/\s{2,}/); // Split by 2+ spaces
             if(singleParts.length >= 2) {
                return { value: singleParts[0], label: `${singleParts[0]} - ${singleParts.slice(1).join(' ')}` };
             }
        }
        return null;
    }).filter(Boolean);
}

export function exportFormData() {
    if (validateForm()) {
        const currentInterface = state.interfaces.find(i => i.id === state.currentInterfaceId);
        const formData = {
            interfaceId: state.currentInterfaceId,
            interfaceName: currentInterface?.name,
            timestamp: new Date().toISOString(),
            metadata: { sender: { name: DOMElements.senderName.value, contact: DOMElements.senderContact.value }, receiver: { name: DOMElements.receiverName.value, contact: DOMElements.receiverContact.value } },
            dataItems: {}
        };
        DOMElements.formContent.querySelectorAll('[data-item-id]').forEach(input => {
            if (input.value) formData.dataItems[input.dataset.itemId] = { name: state.dataItemsCatalogue[input.dataset.itemId]?.name, value: input.value };
        });
        downloadFile(JSON.stringify(formData, null, 2), `${state.currentInterfaceId}_form_data.json`, 'application/json');
        showSuccessMessage('Form data exported successfully!');
    }
}

function validateForm() {
    let isValid = true;
    DOMElements.formContent.querySelectorAll('.validation-error').forEach(el => el.classList.add('hidden'));
    DOMElements.formContent.querySelectorAll('[required]').forEach(input => {
        if (!input.value.trim()) {
            const errorDiv = input.closest('.form-group').querySelector('.validation-error');
            errorDiv.textContent = 'This field is required.';
            errorDiv.classList.remove('hidden');
            isValid = false;
        }
    });
    return isValid;
}
