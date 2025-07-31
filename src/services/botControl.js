class BotControlService {
  constructor() {
    this.bot = null
    this.isRunning = false
    this.startTime = null
  }

  setBot(bot) {
    this.bot = bot
  }

  async startBot() {
    if (!this.bot) {
      throw new Error('Bot instance not set')
    }

    if (this.isRunning) {
      throw new Error('Bot is already running')
    }

    try {
      await this.bot.launch()
      this.isRunning = true
      this.startTime = new Date()
      console.log('Bot started successfully!')
      return { success: true, message: 'Bot started successfully' }
    } catch (error) {
      console.error('Failed to start bot:', error)
      throw new Error(`Failed to start bot: ${error.message}`)
    }
  }

  async stopBot() {
    if (!this.bot) {
      throw new Error('Bot instance not set')
    }

    if (!this.isRunning) {
      throw new Error('Bot is not running')
    }

    try {
      this.bot.stop()
      this.isRunning = false
      this.startTime = null
      console.log('Bot stopped successfully!')
      return { success: true, message: 'Bot stopped successfully' }
    } catch (error) {
      console.error('Failed to stop bot:', error)
      throw new Error(`Failed to stop bot: ${error.message}`)
    }
  }

  async restartBot() {
    try {
      if (this.isRunning) {
        await this.stopBot()
        // Wait a moment before restarting
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      await this.startBot()
      return { success: true, message: 'Bot restarted successfully' }
    } catch (error) {
      console.error('Failed to restart bot:', error)
      throw new Error(`Failed to restart bot: ${error.message}`)
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.isRunning && this.startTime ? Date.now() - this.startTime.getTime() : 0
    }
  }

  formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }
}

module.exports = new BotControlService()