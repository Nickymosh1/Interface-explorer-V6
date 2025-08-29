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
        const blockIdAttr = comp.id ? `data-block-id="${comp.id}"` : '';

        if (comp.type === 'header') {
            return `<div class="bg-[var(--birch)] p-4 rounded-xl"><h3 class="font-bold text-[var(--dark-purple)] text-lg">${escapeHtml(comp.title)}</h3></div>`;
        }
        if (comp.type === 'block' && state.dataBlocksCatalogue[comp.id]) {
            const block = state.dataBlocksCatalogue[comp.id];
            const itemsHtml = block.items.map(itemId => {
                const dataItem = state.dataItemsCatalogue[itemId];
                return dataItem ? generateDataItemInput(itemId, dataItem) : '';
            }).join('');
            return `<div class="bg-white rounded-xl p-4 border border-gray-200" ${blockIdAttr}><h4 class="font-bold text-[var(--eon-red)] mb-4">${escapeHtml(comp.titleOverride || block.title)}</h4><div class="grid gap-4">${itemsHtml}</div></div>`;
        }
        if (comp.type === 'item') {
            const dataItem = state.dataItemsCatalogue[comp.id];
            return dataItem ? `<div class="bg-white rounded-xl p-4 border border-gray-200" ${blockIdAttr}><div class="grid gap-4">${generateDataItemInput(comp.id, dataItem)}</div></div>` : '';
        }
        return '';
    }).join('');
}

function generateDataItemInput(itemId, dataItem) {
    const isRequired = dataItem.cmo === 'M';
    const requiredIndicator = isRequired ? ' <span class="text-red-500">*</span>' : '';
    const labelClass = isRequired ? 'text-red-700 font-semibold' : 'text-[var(--purple)] font-medium';
    
    let options = [];
    let inputHtml = '';
    
    const isAutoPopulated = (itemId === 'DI-000' || itemId === 'DI-992');
    const autoValue = itemId === 'DI-000' ? state.currentInterfaceId : (itemId === 'DI-992' ? '1.0.0' : '');

    if (isAutoPopulated) {
         inputHtml = `<input type="text" value="${escapeHtml(autoValue)}" class="form-input w-full p-2 text-sm border border-gray-300 rounded-lg bg-gray-100 text-gray-500" data-item-id="${itemId}" readonly>`;
    } else if (dataItem.enumerated) {
        options = parsePopulationNotes(dataItem.populationNotes);
        
        if (itemId === 'DI-999') {
            const currentInterface = state.interfaces.find(i => i.id === state.currentInterfaceId);
            const validCodes = currentInterface?.eventCodes || [];
            options = options.filter(opt => validCodes.includes(opt.value));
        }
    }

    if (options.length > 0) {
        const optionsHtml = options.map(opt => `<option value="${escapeHtml(opt.value)}" title="${escapeHtml(opt.label)}">${escapeHtml(opt.label)}</option>`).join('');
        inputHtml = `<select class="form-input w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--eon-red)] focus:border-transparent" data-item-id="${itemId}" data-input-type="enum" ${isRequired ? 'required' : ''}><option value="">Select an option...</option>${optionsHtml}</select>`;
    } else { 
        const inputType = determineInputType(dataItem);
        const placeholder = dataItem.example ? `e.g., ${dataItem.example}` : getPlaceholderByType(inputType);
        
        if (inputType === 'datetime') {
            const nowISOString = getFormattedDateTime();
            const updateButtonHtml = `
                <button type="button" data-action="update-datetime" title="Update to now" class="p-2 text-[var(--purple)] hover:text-[var(--eon-red)] transition-colors rounded-lg hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l5 5M20 20l-5-5"></path></svg>
                </button>
            `;
            inputHtml = `
                <div class="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[var(--eon-red)] focus-within:border-transparent">
                    <input type="text" value="${nowISOString}" placeholder="YYYY-MM-DDTHH:mm:ss+HH:MM" class="form-input w-full p-2 text-sm border-0 rounded-l-lg" data-item-id="${itemId}" data-input-type="datetime" ${isRequired ? 'required' : ''}>
                    ${updateButtonHtml}
                </div>
            `;
        } else {
             switch (inputType) {
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
    }
    const validationHtml = dataItem.rule ? `<p class="text-xs text-gray-600 mt-1">${escapeHtml(dataItem.rule)}</p>` : '' : '';
    const wrapperClass = inputType === 'datetime' ? '' : 'form-input-wrapper';

    return `<div class="form-group"><div class="flex items-start gap-3"><div class="flex-shrink-0 w-16"><code class="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">${escapeHtml(itemId)}</code></div><div class="flex-1"><label class="block text-sm ${labelClass} mb-1">${escapeHtml(dataItem.name)}${requiredIndicator} <span class="text-xs font-normal text-gray-600 ml-2">(${escapeHtml(dataItem.cmo)})</span></label><div class="${wrapperClass}">${inputHtml}</div>${validationHtml}<div class="validation-error text-xs text-red-600 mt-1 hidden"></div></div></div></div>`;
}

// NEW, more robust parser for ALL population notes formats
function parsePopulationNotes(notes) {
    if (!notes) return [];
    if (Array.isArray(notes)) {
        return notes.map(code => ({ value: code, label: code }));
    }

    const options = new Map();
    const cleanedNotes = notes.replace(/’/g, "'").replace(/–/g, "-");

    // Split by common delimiters: newline, or ", -"
    const parts = cleanedNotes.split(/\n|, -/);

    parts.forEach(part => {
        let line = part.trim();
        if (!line) return;
        
        // Remove leading dash if it exists
        if (line.startsWith('-')) {
            line = line.substring(1).trim();
        }

        // Try to match "CODE - Description", "CODE = Description", or "CODE Description"
        const match = line.match(/^'([^']+)'\s+(.*)|^\s*([^\s=]+)\s*(?:-|=)?\s*(.*)/);

        if (match) {
            const code = (match[1] || match[3] || '').trim();
            const desc = (match[2] || match[4] || '').trim();
            if (code) {
                const label = desc ? `${code} - ${desc}` : code;
                 if (!options.has(code)) {
                    options.set(code, { value: code, label: label });
                }
            }
        }
    });
    
    // Fallback for simple comma-separated lists like "_A, _B, _C"
    if (options.size === 0 && cleanedNotes.includes(',')) {
         cleanedNotes.split(',').forEach(part => {
            const code = part.trim();
            if (code && !options.has(code)) {
                options.set(code, { value: code, label: code });
            }
        });
    }

    return Array.from(options.values());
}

export function getFormattedDateTime() {
    const now = new Date();
    const timezoneOffset = -now.getTimezoneOffset();
    const sign = timezoneOffset >= 0 ? '+' : '-';
    const pad = num => String(num).padStart(2, '0');
    const hoursOffset = pad(Math.floor(Math.abs(timezoneOffset) / 60));
    const minutesOffset = pad(Math.abs(timezoneOffset) % 60);
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${hoursOffset}:${minutesOffset}`;
}

function determineInputType(dataItem) {
    const name = dataItem.name.toLowerCase();
    const rule = (dataItem.rule || '').toLowerCase();
    if (/\bdate\b/.test(name) || /\btime\b/.test(name) || /\bdate\b/.test(rule) || /\btime\b/.test(rule)) return 'datetime';
    if (name.includes('number') || name.includes('quantity') || (dataItem.example && /^\d+(\.\d+)?$/.test(dataItem.example))) return 'number';
    if (name.includes('description') || name.includes('additional information')) return 'textarea';
    return 'text';
}

function getPlaceholderByType(type) {
    return { datetime: 'YYYY-MM-DDTHH:mm:ss+HH:MM', number: '12345', textarea: 'Enter details...' }[type] || 'Enter value...';
}

export function exportFormData() {
    if (!validateForm()) return;
    const finalPayload = {};
    const formBlocks = DOMElements.formContent.querySelectorAll('[data-block-id]');
    formBlocks.forEach(blockElement => {
        const blockId = blockElement.dataset.blockId;
        const blockObject = {};
        const inputs = blockElement.querySelectorAll('[data-item-id]');
        inputs.forEach(input => {
            const itemId = input.dataset.itemId;
            if (input.value) {
                blockObject[itemId] = input.value.trim();
            }
        });
        if (Object.keys(blockObject).length > 0) {
            finalPayload[blockId] = blockObject;
        }
    });
    const filename = `${state.currentInterfaceId.replace('/', '_')}_payload.json`;
    downloadFile(JSON.stringify(finalPayload, null, 2), filename, 'application/json');
    showSuccessMessage('Payload exported successfully!');
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
