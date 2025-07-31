$(document).ready(function() {
    let refreshInterval;
    
    // Initialize bot control page
    initBotControl();
    
    function initBotControl() {
        $('#startBtn').on('click', startBot);
        $('#stopBtn').on('click', stopBot);
        $('#restartBtn').on('click', restartBot);
        $('#autoRefresh').on('change', toggleAutoRefresh);
        
        // Start auto refresh by default
        startAutoRefresh();
    }
    
    function startBot() {
        const button = $('#startBtn');
        const originalText = button.html();
        button.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Starting...');
        
        $.ajax({
            url: '/admin/bot/start',
            method: 'POST',
            success: function(response) {
                if (response.success) {
                    showAlert('success', response.success);
                    updateBotStatus();
                } else {
                    showAlert('danger', response.error || 'Failed to start bot');
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                showAlert('danger', response?.error || 'Failed to start bot');
            },
            complete: function() {
                button.prop('disabled', false).html(originalText);
            }
        });
    }
    
    function stopBot() {
        if (!confirm('Are you sure you want to stop the bot?')) {
            return;
        }
        
        const button = $('#stopBtn');
        const originalText = button.html();
        button.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Stopping...');
        
        $.ajax({
            url: '/admin/bot/stop',
            method: 'POST',
            success: function(response) {
                if (response.success) {
                    showAlert('success', response.success);
                    updateBotStatus();
                } else {
                    showAlert('danger', response.error || 'Failed to stop bot');
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                showAlert('danger', response?.error || 'Failed to stop bot');
            },
            complete: function() {
                button.prop('disabled', false).html(originalText);
            }
        });
    }
    
    function restartBot() {
        if (!confirm('Are you sure you want to restart the bot?')) {
            return;
        }
        
        const button = $('#restartBtn');
        const originalText = button.html();
        button.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Restarting...');
        
        $.ajax({
            url: '/admin/bot/restart',
            method: 'POST',
            success: function(response) {
                if (response.success) {
                    showAlert('success', response.success);
                    updateBotStatus();
                } else {
                    showAlert('danger', response.error || 'Failed to restart bot');
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                showAlert('danger', response?.error || 'Failed to restart bot');
            },
            complete: function() {
                button.prop('disabled', false).html(originalText);
            }
        });
    }
    
    function updateBotStatus() {
        $.ajax({
            url: '/admin/bot/status',
            method: 'GET',
            success: function(status) {
                // Update status badge
                const statusBadge = $('#botStatus');
                statusBadge.removeClass('bg-success bg-danger')
                    .addClass(status.isRunning ? 'bg-success' : 'bg-danger')
                    .text(status.isRunning ? 'Running' : 'Stopped');
                
                // Update uptime
                $('#uptime').text(status.uptimeFormatted);
                
                // Update start time
                if (status.isRunning && status.startTime) {
                    $('#startTime').text(new Date(status.startTime).toLocaleString());
                }
                
                // Update buttons
                $('#startBtn').prop('disabled', status.isRunning);
                $('#stopBtn').prop('disabled', !status.isRunning);
            },
            error: function() {
                console.error('Failed to update bot status');
            }
        });
    }
    
    function startAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        
        refreshInterval = setInterval(function() {
            if ($('#autoRefresh').is(':checked')) {
                updateBotStatus();
            }
        }, 5000); // Refresh every 5 seconds
    }
    
    function toggleAutoRefresh() {
        if ($('#autoRefresh').is(':checked')) {
            startAutoRefresh();
        } else {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        }
    }
    
    function showAlert(type, message) {
        // Remove existing alerts
        $('.alert').remove();
        
        // Create new alert
        const alert = $(`
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `);
        
        // Insert at the top of the page
        $('.d-flex.justify-content-between').after(alert);
        
        // Auto dismiss after 5 seconds
        setTimeout(function() {
            alert.fadeOut();
        }, 5000);
    }
    
    // Cleanup on page unload
    $(window).on('beforeunload', function() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
});