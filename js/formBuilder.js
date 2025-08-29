export function exportFormData() {
    if (!validateForm()) return;

    const finalPayload = {
        payload: {
            CommonBlock: {},
            CustomBlock: {}
        }
    };

    const formBlocks = DOMElements.formContent.querySelectorAll('[data-block-id]');

    formBlocks.forEach(blockElement => {
        const blockId = blockElement.dataset.blockId;
        const blockInfo = state.dataBlocksCatalogue[blockId];

        // Skip if the block isn't in our catalogue or doesn't have mapping info
        if (!blockInfo || !blockInfo.shortCode || !blockInfo.group) {
            return;
        }

        const blockObject = {};
        const inputs = blockElement.querySelectorAll('[data-item-id]');

        inputs.forEach(input => {
            const itemId = input.dataset.itemId;
            const itemInfo = state.dataItemsCatalogue[itemId];
            if (input.value && itemInfo && itemInfo.payloadKey) {
                // Use the payloadKey as the key in our final JSON
                blockObject[itemInfo.payloadKey] = input.value.trim();
            }
        });

        if (Object.keys(blockObject).length > 0) {
            // Place the block in the correct group (CommonBlock or CustomBlock)
            if (blockInfo.group === "CommonBlock") {
                finalPayload.payload.CommonBlock[blockInfo.shortCode] = blockObject;
            } else if (blockInfo.group === "CustomBlock") {
                finalPayload.payload.CustomBlock[blockInfo.shortCode] = blockObject;
            }
        }
    });

    const filename = `${state.currentInterfaceId.replace('/', '_')}_payload.json`;
    downloadFile(JSON.stringify(finalPayload, null, 4), filename, 'application/json'); // Indent by 4 to match example
    showSuccessMessage('Payload exported successfully!');
}
