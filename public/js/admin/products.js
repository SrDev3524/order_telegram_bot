$(document).ready(function() {
    const ProductManager = {
        init() {
            this.bindEvents()
        },

        bindEvents() {
            // Add product button
            $('#addProductBtn').on('click', () => this.showAddModal())
            
            // Edit product buttons
            $(document).on('click', '.edit-product', (e) => {
                const productId = $(e.currentTarget).data('product-id')
                this.showEditModal(productId)
            })
            
            // Delete product buttons
            $(document).on('click', '.delete-product', (e) => {
                const productId = $(e.currentTarget).data('product-id')
                const productName = $(e.currentTarget).data('product-name')
                this.showDeleteModal(productId, productName)
            })
            
            // Form submission
            $('#productForm').on('submit', (e) => this.handleFormSubmit(e))
            
            // Delete confirmation
            $('#confirmDeleteProduct').on('click', () => this.confirmDelete())
            
            // Image preview
            $('#productImages').on('change', (e) => this.previewImages(e))
        },

        showAddModal() {
            this.resetForm()
            $('#productModalTitle').text('Додати товар')
            $('#productForm').attr('action', '/admin/products').attr('method', 'POST')
            $('#productModal').modal('show')
        },

        async showEditModal(productId) {
            try {
                const response = await $.get(`/admin/products/api/${productId}`)
                
                console.log('Raw product data from server:', response)
                
                this.resetForm()
                this.populateForm(response)
                $('#productModalTitle').text('Редагувати товар')
                $('#productForm').removeAttr('action').removeAttr('method')
                $('#productModal').modal('show')
            } catch (error) {
                this.showAlert('error', 'Помилка завантаження товару: ' + error.message)
                console.error('Error loading product:', error)
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
        },

        populateForm(product) {
            console.log('Populating form with product data:', product)
            
            // Debug: Check what fields exist on the product object
            console.log('Product fields:', Object.keys(product))
            console.log('Price value:', product.price, typeof product.price)
            console.log('Sale price value:', product.sale_price, typeof product.sale_price)
            console.log('Stock quantity value:', product.stock_quantity, typeof product.stock_quantity)
            console.log('Active value:', product.active, typeof product.active)
            
            // Populate all form fields with exact matches
            $('#productId').val(product.id || '')
            $('#productName').val(product.name || '')
            $('#productDescription').val(product.description || '')
            $('#productCategory').val(product.category_id || '')
            $('#productSku').val(product.sku || '')
            
            // Make sure price fields are properly set
            $('#productPrice').val(product.price || '')
            $('#salePrice').val(product.sale_price || '')
            $('#productStock').val(product.stock_quantity || 0)
            
            // Handle checkbox properly
            $('#productActive').prop('checked', product.active === 1 || product.active === true)
            
            // Debug: Check if form fields were actually populated
            setTimeout(() => {
                console.log('Form values after population:')
                console.log('Name:', $('#productName').val())
                console.log('Price:', $('#productPrice').val())
                console.log('Sale Price:', $('#salePrice').val())
                console.log('Stock:', $('#productStock').val())
                console.log('Active:', $('#productActive').prop('checked'))
                console.log('Category:', $('#productCategory').val())
            }, 100)
            
            // Show existing images
            if (product.images) {
                try {
                    const images = typeof product.images === 'string' 
                        ? JSON.parse(product.images) 
                        : product.images
                    if (Array.isArray(images) && images.length > 0) {
                        this.showExistingImages(images)
                    }
                } catch (e) {
                    console.error('Error parsing product images:', e)
                }
            }
        },

        showExistingImages(images) {
            const container = $('#imagePreviewContainer')
            container.empty()
            
            images.forEach(imagePath => {
                const imageHtml = `
                    <div class="existing-image mb-2">
                        <img src="${imagePath}" alt="Product image" 
                             class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover;">
                    </div>
                `
                container.append(imageHtml)
            })
        },

        previewImages(event) {
            const container = $('#imagePreviewContainer')
            container.find('.new-image').remove()
            
            const files = event.target.files
            
            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader()
                    reader.onload = (e) => {
                        const imageHtml = `
                            <div class="new-image mb-2">
                                <img src="${e.target.result}" alt="Preview" 
                                     class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover;">
                            </div>
                        `
                        container.append(imageHtml)
                    }
                    reader.readAsDataURL(file)
                }
            })
        },

        async handleFormSubmit(e) {
            const productId = $('#productId').val()
            const isEdit = !!productId
            
            // For new products, let the form submit normally
            if (!isEdit) {
                const name = $('#productName').val().trim()
                const price = $('#productPrice').val()
                const categoryId = $('#productCategory').val()
                
                if (!name || !price || !categoryId) {
                    e.preventDefault()
                    this.showAlert('error', 'Заповніть всі обовʼязкові поля')
                    return false
                }
                
                return true // Allow normal form submission
            }
            
            // For edit mode, handle with AJAX
            e.preventDefault()
            
            const submitBtn = $('#productForm button[type="submit"]')
            submitBtn.prop('disabled', true)
            
            try {
                const formData = new FormData(e.target)
                
                // Debug: Log form data
                for (let pair of formData.entries()) {
                    console.log(pair[0] + ': ' + pair[1])
                }
                
                const response = await $.ajax({
                    url: `/admin/products/${productId}`,
                    method: 'PUT',
                    data: formData,
                    processData: false,
                    contentType: false
                })
                
                this.showAlert('success', response.message)
                $('#productModal').modal('hide')
                setTimeout(() => window.location.reload(), 1500)
                
            } catch (error) {
                const message = error.responseJSON?.error || 'Помилка збереження товару'
                this.showAlert('error', message)
                console.error('Error saving product:', error)
            } finally {
                submitBtn.prop('disabled', false)
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
                this.showAlert('success', 'Товар успішно видалено')
                
                $(`tr[data-product-id="${productId}"]`).fadeOut(300, function() {
                    $(this).remove()
                })
                
            } catch (error) {
                const message = error.responseJSON?.error || 'Помилка видалення товару'
                this.showAlert('error', message)
                console.error('Error deleting product:', error)
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
        }
    }
    
    ProductManager.init()
})