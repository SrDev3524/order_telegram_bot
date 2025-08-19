let ProductManager;

$(document).ready(function() {
    ProductManager = {
        // State
        currentExistingImages: [],
        lightbox: null,
        modalLightbox: null,
        
        // Configuration
        config: {
            imageUploadLimit: 20,
            imageThumbnailSize: '100px',
            lightboxOptions: {
                loop: true,
                preload: true,
                touchNavigation: true,
                closeOnOutsideClick: true,
                descPosition: 'bottom'
            }
        },
        
        // DataTable instance
        dataTable: null,
        
        // Initialization
        init() {
            this.bindEvents()
            this.initLightbox()
            this.initDataTable()
        },
        
        initDataTable() {
            if (typeof $.fn.DataTable === 'undefined') {
                console.warn('DataTables library not loaded')
                return
            }
            
            this.dataTable = $('#productsTable').DataTable({
                pageLength: 10,
                lengthMenu: [5, 10, 25, 50, 100],
                order: [[0, 'desc']],
                columnDefs: [
                    { orderable: false, targets: [1, 8] }, // Image and Actions columns
                    { searchable: false, targets: [1, 8] }
                ],
                language: {
                    search: "Пошук товарів:",
                    lengthMenu: "Показати _MENU_ товарів на сторінці",
                    info: "Показано _START_ до _END_ з _TOTAL_ товарів",
                    infoEmpty: "Товари не знайдені",
                    infoFiltered: "(відфільтровано з _MAX_ загальних товарів)",
                    zeroRecords: "Немає товарів для відображення",
                    emptyTable: "Немає даних у таблиці",
                    paginate: {
                        first: "Перша",
                        last: "Остання", 
                        next: "Наступна",
                        previous: "Попередня"
                    },
                    processing: "Обробка...",
                    loadingRecords: "Завантаження записів..."
                },
                dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>t<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
                responsive: true
            })
        },
        
        initLightbox() {
            if (typeof GLightbox === 'undefined') return
            
            // Initialize lightbox for product thumbnails in table
            this.initTableGalleries()
        },
        
        initTableGalleries() {
            const productIds = this.getUniqueProductIds()
            
            productIds.forEach(productId => {
                GLightbox({
                    selector: `.glightbox-product-${productId}`,
                    ...this.config.lightboxOptions
                })
            })
        },
        
        initModalGallery() {
            if (typeof GLightbox === 'undefined') return
            
            // Destroy existing modal lightbox if exists
            if (this.modalLightbox) {
                this.modalLightbox.destroy()
            }
            
            // Initialize new modal lightbox
            setTimeout(() => {
                this.modalLightbox = GLightbox({
                    selector: '.glightbox-modal',
                    loop: true
                })
            }, 100)
        },
        
        getUniqueProductIds() {
            const productIds = new Set()
            $('.product-thumbnail').each(function() {
                const classes = $(this).parent().attr('class')
                if (classes) {
                    const match = classes.match(/glightbox-product-(\\d+)/)
                    if (match) productIds.add(match[1])
                }
            })
            return productIds
        },

        // Event Binding
        bindEvents() {
            // Modal events
            $('#addProductBtn').on('click', () => this.showAddModal())
            $(document).on('click', '.edit-product', (e) => this.handleEditClick(e))
            $(document).on('click', '.delete-product', (e) => this.handleDeleteClick(e))
            
            // Form events
            $('#productForm').on('submit', (e) => this.handleFormSubmit(e))
            $('#confirmDeleteProduct').on('click', () => this.confirmDelete())
            $('#productImages').on('change', (e) => this.previewImages(e))
            
            // Modal cleanup
            $('#productModal').on('hidden.bs.modal', () => this.resetForm())
        },
        
        handleEditClick(e) {
            const productId = $(e.currentTarget).data('product-id')
            this.showEditModal(productId)
        },
        
        handleDeleteClick(e) {
            const $target = $(e.currentTarget)
            const productId = $target.data('product-id')
            const productName = $target.data('product-name')
            this.showDeleteModal(productId, productName)
        },

        // Modal Management
        showAddModal() {
            this.resetForm()
            $('#productModalTitle').text('Додати товар')
            $('#productForm').attr('action', '/admin/products').attr('method', 'POST')
            $('#productModal').modal('show')
        },

        async showEditModal(productId) {
            try {
                const response = await $.get(`/admin/products/api/${productId}`)
                this.resetForm()
                this.populateForm(response)
                $('#productModalTitle').text('Редагувати товар')
                $('#productForm').removeAttr('action').removeAttr('method')
                $('#productModal').modal('show')
            } catch (error) {
                this.showAlert('error', 'Помилка завантаження товару: ' + error.message)
            }
        },

        showDeleteModal(productId, productName) {
            $('#deleteProductName').text(productName)
            $('#confirmDeleteProduct').data('product-id', productId)
            $('#deleteModal').modal('show')
        },

        // Form Management
        resetForm() {
            $('#productForm')[0].reset()
            $('#productId').val('')
            $('#imagePreviewContainer').empty()
            $('#existingImagesData').remove()
            $('#productModal .alert').remove()
            $('#productForm button[type="submit"]').html('Зберегти').prop('disabled', false)
            this.currentExistingImages = []
            
            // Destroy modal lightbox
            if (this.modalLightbox) {
                this.modalLightbox.destroy()
                this.modalLightbox = null
            }
        },

        populateForm(product) {
            // Basic fields
            $('#productId').val(product.id || '')
            $('#productName').val(product.name || '')
            $('#productDescription').val(product.description || '')
            $('#productCategory').val(product.category_id || '')
            $('#productSku').val(product.sku || '')
            $('#productPrice').val(product.price || '')
            $('#salePrice').val(product.sale_price || '')
            $('#productStock').val(product.stock_quantity || 0)
            $('#productActive').prop('checked', product.active === 1 || product.active === true)
            
            // Handle images
            this.currentExistingImages = this.parseProductImages(product.images)
            if (this.currentExistingImages.length > 0) {
                this.showAllImages()
            }
        },
        
        parseProductImages(images) {
            if (!images) return []
            
            if (typeof images === 'string') {
                // Check if JSON or single path
                if (images.startsWith('[') || images.startsWith('{')) {
                    try {
                        return JSON.parse(images)
                    } catch (e) {
                        return [images]
                    }
                }
                return [images]
            }
            
            if (Array.isArray(images)) return images
            
            return []
        },

        // Image Management
        showAllImages() {
            const container = $('#imagePreviewContainer')
            container.empty()
            
            this.updateExistingImagesField()
            this.renderExistingImages(container)
            this.renderNewImages(container)
            this.initModalGallery()
        },
        
        updateExistingImagesField() {
            $('#existingImagesData').remove()
            $('<input>').attr({
                type: 'hidden',
                id: 'existingImagesData',
                name: 'existingImages',
                value: JSON.stringify(this.currentExistingImages)
            }).appendTo('#productForm')
        },
        
        renderExistingImages(container) {
            this.currentExistingImages.forEach((imagePath, index) => {
                const imageHtml = this.createImageElement(imagePath, index, 'existing')
                container.append(imageHtml)
            })
        },
        
        renderNewImages(container) {
            const files = $('#productImages')[0].files
            Array.from(files).forEach((file) => {
                this.addNewImagePreview(file, container)
            })
        },
        
        createImageElement(imagePath, index, type) {
            const isExisting = type === 'existing'
            const buttonClass = isExisting ? 'btn-danger' : 'btn-warning'
            const onClickHandler = isExisting 
                ? `ProductManager.removeImage(${index})` 
                : `ProductManager.removeNewImage(this)`
            
            return `
                <div class="image-item d-inline-block me-2 mb-2 position-relative ${isExisting ? '' : 'new-image'}">
                    <a href="${imagePath}" class="glightbox-modal" data-gallery="modal-gallery">
                        <img src="${imagePath}" alt="Product image" 
                             class="img-thumbnail" 
                             style="width: ${this.config.imageThumbnailSize}; height: ${this.config.imageThumbnailSize}; object-fit: cover; cursor: pointer;">
                    </a>
                    <button type="button" class="btn btn-sm ${buttonClass} position-absolute top-0 end-0" 
                            onclick="${onClickHandler}"
                            style="padding: 2px 6px; font-size: 12px;">
                        ×
                    </button>
                </div>
            `
        },
        
        addNewImagePreview(file, container) {
            if (!file.type.startsWith('image/')) return
            
            const reader = new FileReader()
            reader.onload = (e) => {
                const imageHtml = this.createImageElement(e.target.result, null, 'new')
                container.append(imageHtml)
                this.initModalGallery()
            }
            reader.readAsDataURL(file)
        },
        
        removeImage(index) {
            this.currentExistingImages.splice(index, 1)
            this.showAllImages()
        },
        
        removeNewImage(button) {
            $(button).closest('.new-image').remove()
        },

        previewImages() {
            this.showAllImages()
        },

        // Form Submission
        async handleFormSubmit(e) {
            const productId = $('#productId').val()
            const isEdit = !!productId
            
            if (!isEdit) {
                return this.handleNewProduct(e)
            }
            
            e.preventDefault()
            await this.handleEditProduct(productId, e.target)
        },
        
        handleNewProduct(e) {
            const name = $('#productName').val().trim()
            const price = $('#productPrice').val()
            const categoryId = $('#productCategory').val()
            
            if (!name || !price || !categoryId) {
                e.preventDefault()
                this.showAlert('error', 'Будь ласка, заповніть всі обов\'язкові поля')
                return false
            }
            return true
        },
        
        async handleEditProduct(productId, form) {
            const submitBtn = $('#productForm button[type="submit"]')
            submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Збереження...')
            
            try {
                const formData = new FormData(form)
                
                const response = await $.ajax({
                    url: `/admin/products/${productId}`,
                    method: 'PUT',
                    data: formData,
                    processData: false,
                    contentType: false
                })
                
                if (response && response.message) {
                    await this.handleSuccessfulUpdate(productId, formData)
                } else {
                    this.showModalAlert('error', 'Неочікувана відповідь від сервера')
                }
                
            } catch (error) {
                const message = error.responseJSON?.error || error.statusText || 'Помилка збереження товару'
                this.showModalAlert('error', message)
            } finally {
                submitBtn.html('Зберегти').prop('disabled', false)
            }
        },
        
        async handleSuccessfulUpdate(productId, formData) {
            this.showModalAlert('success', 'Товар успішно збережено!')
            $('#productImages').val('')
            
            // Refresh product data
            const updatedProduct = await $.get(`/admin/products/api/${productId}`)
            this.currentExistingImages = this.parseProductImages(updatedProduct.images)
            this.showAllImages()
            
            // Update table row
            this.updateProductRow(productId, formData)
        },

        // Delete Operations
        async confirmDelete() {
            const productId = $('#confirmDeleteProduct').data('product-id')
            
            try {
                await $.ajax({
                    url: `/admin/products/${productId}`,
                    method: 'DELETE'
                })
                
                $('#deleteModal').modal('hide')
                this.showAlert('success', 'Товар успішно видалено')
                
                const row = $(`tr[data-product-id="${productId}"]`)
                if (this.dataTable) {
                    this.dataTable.row(row).remove().draw()
                } else {
                    row.fadeOut(300, function() {
                        $(this).remove()
                    })
                }
                
            } catch (error) {
                const message = error.responseJSON?.error || 'Помилка видалення товару'
                this.showAlert('error', message)
            }
        },

        // UI Updates
        updateProductRow(productId, formData) {
            const row = $(`tr[data-product-id="${productId}"]`)
            if (!row.length) return
            
            const name = formData.get('name')
            const price = formData.get('price')
            const stock = formData.get('stock_quantity')
            const active = formData.get('active') === 'on'
            
            row.find('td:nth-child(3)').text(name)
            row.find('td:nth-child(5)').text(price + ' UAH')
            row.find('td:nth-child(7)').text(stock)
            
            this.updateStatusBadge(row, active)
            
            // Redraw DataTable to update sorting and filtering
            if (this.dataTable) {
                this.dataTable.draw()
            }
        },
        
        updateStatusBadge(row, active) {
            const statusCell = row.find('td:nth-child(8)')
            if (active) {
                statusCell.html('<span class="badge bg-success">Активний</span>')
                row.removeClass('table-secondary')
            } else {
                statusCell.html('<span class="badge bg-secondary">Неактивний</span>')
                row.addClass('table-secondary')
            }
        },

        // Alert Management
        showAlert(type, message) {
            const alertClass = type === 'success' ? 'alert-success' : 'alert-danger'
            const alertHtml = `
                <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `
            $('.alert').remove()
            $('.d-flex.justify-content-between').after(alertHtml)
        },
        
        showModalAlert(type, message) {
            const alertClass = type === 'success' ? 'alert-success' : 'alert-danger'
            const iconClass = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'
            const alertHtml = `
                <div class="alert ${alertClass} alert-dismissible fade show mt-3" role="alert">
                    <i class="fas ${iconClass} me-2"></i>${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `
            $('#productModal .alert').remove()
            $('#productModal .modal-header').after(alertHtml)
            
            if (type === 'success') {
                setTimeout(() => {
                    $('#productModal .alert-success').fadeOut(500, function() {
                        $(this).remove()
                    })
                }, 5000)
            }
        }
    }
    
    // Initialize ProductManager
    ProductManager.init()
})