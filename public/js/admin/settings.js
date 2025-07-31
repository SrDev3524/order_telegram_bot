$(document).ready(function() {
    // Initialize settings page
    initSettings();
    
    function initSettings() {
        $('#adminForm').on('submit', handleAdminFormSubmit);
        $('#systemForm').on('submit', handleSystemFormSubmit);
        $('#backupForm').on('submit', handleBackupFormSubmit);
        $('#restoreForm').on('submit', handleRestoreFormSubmit);
        $('#newPassword, #confirmPassword').on('input', validatePasswords);
    }
    
    function handleAdminFormSubmit(e) {
        e.preventDefault();
        
        const newPassword = $('#newPassword').val();
        const confirmPassword = $('#confirmPassword').val();
        
        // Validate passwords if new password is provided
        if (newPassword && newPassword !== confirmPassword) {
            alert('Нові паролі не співпадають');
            return;
        }
        
        if (newPassword && newPassword.length < 6) {
            alert('Пароль повинен містити принаймні 6 символів');
            return;
        }
        
        // Submit form
        const formData = $(this).serialize();
        
        $.ajax({
            url: '/admin/settings/admin',
            method: 'POST',
            data: formData,
            success: function(response) {
                if (response.success) {
                    location.reload();
                } else {
                    alert(response.error || 'Помилка оновлення даних');
                }
            },
            error: function() {
                alert('Помилка оновлення даних адміністратора');
            }
        });
    }
    
    function handleSystemFormSubmit(e) {
        e.preventDefault();
        
        const formData = $(this).serialize();
        
        $.ajax({
            url: '/admin/settings/system',
            method: 'POST',
            data: formData,
            success: function(response) {
                if (response.success) {
                    location.reload();
                } else {
                    alert(response.error || 'Помилка оновлення налаштувань');
                }
            },
            error: function() {
                alert('Помилка оновлення системних налаштувань');
            }
        });
    }
    
    function handleBackupFormSubmit(e) {
        e.preventDefault();
        
        const dateFrom = $('#dateFrom').val();
        const dateTo = $('#dateTo').val();
        
        let url = '/admin/settings/backup';
        const params = new URLSearchParams();
        
        if (dateFrom) params.append('dateFrom', dateFrom);
        if (dateTo) params.append('dateTo', dateTo);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        // Download backup file
        window.location.href = url;
    }
    
    function handleRestoreFormSubmit(e) {
        e.preventDefault();
        
        const fileInput = $('#sqlFile')[0];
        const file = fileInput.files[0];
        
        if (!file) {
            alert('Please select a SQL file to restore');
            return;
        }
        
        if (!confirm('Are you sure you want to restore the database? This will overwrite existing data.')) {
            return;
        }
        
        const formData = new FormData();
        formData.append('sqlFile', file);
        
        const button = $(this).find('button[type="submit"]');
        const originalText = button.html();
        button.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Restoring...');
        
        $.ajax({
            url: '/admin/settings/restore',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    alert(response.success + '\n' + response.details);
                    location.reload();
                } else {
                    alert(response.error || 'Restore failed');
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                alert(response?.error || 'Restore failed');
            },
            complete: function() {
                button.prop('disabled', false).html(originalText);
            }
        });
    }
    
    function validatePasswords() {
        const newPassword = $('#newPassword').val();
        const confirmPassword = $('#confirmPassword').val();
        const confirmField = $('#confirmPassword')[0];
        
        if (newPassword && confirmPassword) {
            if (newPassword === confirmPassword) {
                confirmField.setCustomValidity('');
                $('#confirmPassword').removeClass('is-invalid').addClass('is-valid');
            } else {
                confirmField.setCustomValidity('Паролі не співпадають');
                $('#confirmPassword').removeClass('is-valid').addClass('is-invalid');
            }
        } else {
            confirmField.setCustomValidity('');
            $('#confirmPassword').removeClass('is-invalid is-valid');
        }
    }
});