let ProductManager;

$(document).ready(function() {
    ProductManager = {
        currentExistingImages: [],
        
        init() {
            this.bindEvents()
        },

        bindEvents() {
            $('#addProductBtn').on('click', () => this.showAddModal())
            $(document).on('click', '.edit-product', (e) => {
                const productId = $(e.currentTarget).data('product-id')
                this.showEditModal(productId)
            })
            $(document).on('click', '.delete-product', (e) => {
                const productId = $(e.currentTarget).data('product-id')
                const productName = $(e.currentTarget).data('product-name')
                this.showDeleteModal(productId, productName)
            })
            $('#productForm').on('submit', (e) => this.handleFormSubmit(e))
            $('#confirmDeleteProduct').on('click', () => this.confirmDelete())
            $('#productImages').on('change', (e) => this.previewImages(e))
            $('#productModal').on('hidden.bs.modal', () => {
                this.resetForm()
            })
        },

        showAddModal() {
            this.resetForm()
            $('#productModalTitle').text('Add Product')
            $('#productForm').attr('action', '/admin/products').attr('method', 'POST')
            $('#productModal').modal('show')
        },

        async showEditModal(productId) {
            try {
                const response = await $.get(`/admin/products/api/${productId}`)
                this.resetForm()
                this.populateForm(response)
                $('#productModalTitle').text('Edit Product')
                $('#productForm').removeAttr('action').removeAttr('method')
                $('#productModal').modal('show')
            } catch (error) {
                this.showAlert('error', 'Error loading product: ' + error.message)
            }
        },

        showDeleteModal(productId, productName) {
            $('#deleteProductName').text(productName)
            $('#confirmDeleteProduct').data('product-id', productId)
            $('#deleteModal').modal('show')
        },

        resetForm() {
            $('#productForm')[0].reset()
            $('#productId').val('')
            $('#imagePreviewContainer').empty()
            $('#existingImagesData').remove()
            $('#productModal .alert').remove()
            $('#productForm button[type="submit"]').html('Save').prop('disabled', false)
            this.currentExistingImages = []
        },

        populateForm(product) {
            $('#productId').val(product.id || '')
            $('#productName').val(product.name || '')
            $('#productDescription').val(product.description || '')
            $('#productCategory').val(product.category_id || '')
            $('#productSku').val(product.sku || '')
            $('#productPrice').val(product.price || '')
            $('#salePrice').val(product.sale_price || '')
            $('#productStock').val(product.stock_quantity || 0)
            $('#productActive').prop('checked', product.active === 1 || product.active === true)
            
            if (product.images) {
                try {
                    const images = typeof product.images === 'string' 
                        ? JSON.parse(product.images) 
                        : product.images
                    if (Array.isArray(images) && images.length > 0) {
                        this.currentExistingImages = images
                        this.showAllImages()
                    }
                } catch (e) {
                    console.error('Error parsing existing images:', e)
                }
            }
        },

        showAllImages() {
            const container = $('#imagePreviewContainer')
            container.empty()
            
            $('#existingImagesData').remove()
            $('<input>').attr({
                type: 'hidden',
                id: 'existingImagesData',
                name: 'existingImages',
                value: JSON.stringify(this.currentExistingImages)
            }).appendTo('#productForm')
            
            this.currentExistingImages.forEach((imagePath, index) => {
                const imageHtml = `
                    <div class="image-item d-inline-block me-2 mb-2 position-relative">
                        <img src="${imagePath}" alt="Product image" 
                             class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover;">
                        <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0" 
                                onclick="ProductManager.removeImage(${index})"
                                style="padding: 2px 6px; font-size: 12px;">
                            ×
                        </button>
                    </div>
                `
                container.append(imageHtml)
            })
            
            const files = $('#productImages')[0].files
            Array.from(files).forEach((file) => {
                this.addNewImagePreview(file, container)
            })
        },
        
        addNewImagePreview(file, container) {
            if (!file.type.startsWith('image/')) return
            
            const reader = new FileReader()
            reader.onload = (e) => {
                const imageHtml = `
                    <div class="image-item d-inline-block me-2 mb-2 position-relative new-image">
                        <img src="${e.target.result}" alt="New image" 
                             class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover;">
                        <button type="button" class="btn btn-sm btn-warning position-absolute top-0 end-0" 
                                onclick="ProductManager.removeNewImage(this)"
                                style="padding: 2px 6px; font-size: 12px;">
                            ×
                        </button>
                    </div>
                `
                container.append(imageHtml)
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

        previewImages(event) {
            this.showAllImages()
        },

        async handleFormSubmit(e) {
            const productId = $('#productId').val()
            const isEdit = !!productId
            
            if (!isEdit) {
                const name = $('#productName').val().trim()
                const price = $('#productPrice').val()
                const categoryId = $('#productCategory').val()
                
                if (!name || !price || !categoryId) {
                    e.preventDefault()
                    this.showAlert('error', 'Please fill all required fields')
                    return false
                }
                return true
            }
            
            e.preventDefault()
            const submitBtn = $('#productForm button[type="submit"]')
            submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Saving...')
            
            try {
                const formData = new FormData(e.target)
                
                const response = await $.ajax({
                    url: `/admin/products/${productId}`,
                    method: 'PUT',
                    data: formData,
                    processData: false,
                    contentType: false
                })
                
                this.showModalAlert('success', 'Product saved successfully!')
                $('#productImages').val('')
                
                const updatedProduct = await $.get(`/admin/products/api/${productId}`)
                this.currentExistingImages = JSON.parse(updatedProduct.images || '[]')
                this.showAllImages()
                
                this.updateProductRow(productId, formData)
                
            } catch (error) {
                const message = error.responseJSON?.error || 'Error saving product'
                this.showModalAlert('error', message)
            } finally {
                submitBtn.html('Save').prop('disabled', false)
            }
        },

        async confirmDelete() {
            const productId = $('#confirmDeleteProduct').data('product-id')
            
            try {
                await $.ajax({
                    url: `/admin/products/${productId}`,
                    method: 'DELETE'
                })
                
                $('#deleteModal').modal('hide')
                this.showAlert('success', 'Product deleted successfully')
                
                $(`tr[data-product-id="${productId}"]`).fadeOut(300, function() {
                    $(this).remove()
                })
                
            } catch (error) {
                const message = error.responseJSON?.error || 'Error deleting product'
                this.showAlert('error', message)
            }
        },

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
        },
        
        updateProductRow(productId, formData) {
            const row = $(`tr[data-product-id="${productId}"]`)
            if (row.length) {
                const name = formData.get('name')
                const price = formData.get('price')
                const stock = formData.get('stock_quantity')
                const active = formData.get('active') === 'on'
                
                row.find('td:nth-child(3)').text(name)
                row.find('td:nth-child(5)').text(price + '₴')
                row.find('td:nth-child(7)').text(stock)
                
                const statusCell = row.find('td:nth-child(8)')
                if (active) {
                    statusCell.html('<span class="badge bg-success">Active</span>')
                    row.removeClass('table-secondary')
                } else {
                    statusCell.html('<span class="badge bg-secondary">Inactive</span>')
                    row.addClass('table-secondary')
                }
            }
        }
    }
    
    ProductManager.init()
})