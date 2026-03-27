

require("../settings.js")

const fs = require("fs")
const path = require("path")

class DatabaseManager {
  constructor() {
    this.dbPath = path.join(__dirname, "bot.json")
    this.data = this.load()
    this.initializeTables()
  }

  load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, "utf8")
        return JSON.parse(content)
      }
    } catch (e) {
      console.error("Error loading database:", e.message)
    }

    return {
      users: [],
      sessions: [],
      logs: [],
      config: {}
    }
  }

  save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2))
    } catch (e) {
      console.error("Error saving database:", e.message)
    }
  }

  initializeTables() {
    console.log("Database initialized")
    this.save()
  }

  createUser(telegramId, username, firstName, lastName) {
    const existing = this.data.users.find(u => u.telegram_id === telegramId)
    
    if (!existing) {
      this.data.users.push({
        id: this.data.users.length + 1,
        telegram_id: telegramId,
        username,
        first_name: firstName,
        last_name: lastName,
        is_approved: telegramId === parseInt(global.ownid) ? 1 : 0,
        is_banned: 0,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      })
      this.save()
      return true
    }

    return false
  }

  getUser(telegramId) {
    return this.data.users.find(u => u.telegram_id === telegramId)
  }

  updateUser(telegramId, data) {
    const user = this.data.users.find(u => u.telegram_id === telegramId)
    
    if (user) {
      Object.assign(user, data, { last_active: new Date().toISOString() })
      this.save()
      return true
    }

    return false
  }

  approveUser(telegramId) {
    return this.updateUser(telegramId, { is_approved: 1 })
  }

  rejectUser(telegramId) {
    return this.updateUser(telegramId, { is_approved: 0 })
  }

  banUser(telegramId) {
    return this.updateUser(telegramId, { is_banned: 1 })
  }

  unbanUser(telegramId) {
    return this.updateUser(telegramId, { is_banned: 0 })
  }

  getAllUsers() {
    return this.data.users
  }

  getApprovedUsers() {
    return this.data.users.filter(u => u.is_approved === 1)
  }

  getPendingUsers() {
    return this.data.users.filter(u => u.is_approved === 0)
  }

  saveSession(telegramId, message, response, usedTool = null, toolResult = null) {
    const session = {
      id: this.data.sessions.length + 1,
      user_id: telegramId,
      message,
      response,
      used_tool: usedTool,
      tool_result: toolResult ? JSON.stringify(toolResult) : null,
      created_at: new Date().toISOString()
    }

    this.data.sessions.push(session)
    this.save()
    return session.id
  }

  getUserSessions(telegramId, limit = 50) {
    return this.data.sessions
      .filter(s => s.user_id === telegramId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
  }

  clearUserSessions(telegramId) {
    const before = this.data.sessions.length
    this.data.sessions = this.data.sessions.filter(s => s.user_id !== telegramId)
    this.save()
    return before - this.data.sessions.length
  }

  getSessionCount(telegramId) {
    return this.data.sessions.filter(s => s.user_id === telegramId).length
  }

  log(eventType, userId, data) {
    const log = {
      id: this.data.logs.length + 1,
      event_type: eventType,
      user_id: userId,
      data: JSON.stringify(data),
      created_at: new Date().toISOString()
    }

    this.data.logs.push(log)
    this.save()
    return log.id
  }

  getLogs(limit = 100) {
    return this.data.logs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
  }

  clearLogs() {
    const before = this.data.logs.length
    this.data.logs = []
    this.save()
    return before
  }

  setConfig(key, value) {
    this.data.config[key] = value
    this.save()
    return true
  }

  getConfig(key) {
    return this.data.config[key] || null
  }

  getAllConfig() {
    return this.data.config
  }

  getStats() {
    return {
      totalUsers: this.data.users.length,
      approvedUsers: this.data.users.filter(u => u.is_approved === 1).length,
      totalSessions: this.data.sessions.length,
      totalLogs: this.data.logs.length
    }
  }

  close() {
    this.save()
    console.log("Database closed")
  }
}

module.exports = DatabaseManager
