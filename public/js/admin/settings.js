$(document).ready(function() {
    // Initialize settings page
    initSettings();
    
    function initSettings() {
        $('#adminForm').on('submit', handleAdminFormSubmit);
        $('#systemForm').on('submit', handleSystemFormSubmit);
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