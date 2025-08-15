function createImagePreview(file, containerSelector, options = {}) {
    const {
        maxHeight = '100px',
        maxWidth = '100%',
        showFileName = false,
        className = 'mb-2'
    } = options;

    if (!file || !file.type.startsWith('image/')) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageDiv = document.createElement('div');
        imageDiv.className = className;
        
        let html = `<img src="${e.target.result}" class="img-fluid border rounded" style="max-height: ${maxHeight}; max-width: ${maxWidth};">`;
        
        if (showFileName) {
            html += `<small class="text-muted d-block">${file.name}</small>`;
        }
        
        imageDiv.innerHTML = html;
        
        const container = document.querySelector(containerSelector);
        if (container) {
            container.appendChild(imageDiv);
        }
    };
    
    reader.readAsDataURL(file);
}

function previewMultipleImages(files, containerSelector, options = {}) {
    const container = document.querySelector(containerSelector);
    if (container) {
        container.innerHTML = '';
    }
    
    Array.from(files).forEach(file => {
        createImagePreview(file, containerSelector, options);
    });
}

$(document).ready(function() {
  // Admin panel initialization
})
