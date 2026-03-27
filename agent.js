// agent.js - Main Bot Logic dengan Interactive Features

require("./settings.js")

const { Telegraf, Markup } = require("telegraf")
const MCPConnector = require("./lib/connector.js")
const GeminiLogic = require("./lib/logic.js")
const AIFunctions = require("./lib/function.js")
const DatabaseManager = require("./database/manager.js")
const https = require("https")
const http = require("http")
const fs = require("fs")
const path = require("path")

class Agent {
  constructor() {
    this.bot = new Telegraf(global.token)
    this.mcp = new MCPConnector()
    this.ai = new GeminiLogic()
    this.db = new DatabaseManager()
    this.pendingApprovals = new Map()

    this.initializeMiddleware()
    this.initializeHandlers()
  }

  initializeMiddleware() {
    this.bot.use(async (ctx, next) => {
      if (!ctx.from || !ctx.from.id) return

      const userId = ctx.from.id
      const username = ctx.from.username
      const firstName = ctx.from.first_name
      const lastName = ctx.from.last_name

      await this.db.createUser(userId, username, firstName, lastName)

      const user = await this.db.getUser(userId)

      if (user) {
        if (userId === parseInt(global.ownid)) {
          ctx.isOwner = true
          ctx.isAuthorized = true
        } else if (user.is_banned) {
          ctx.isAuthorized = false
          return
        } else if (user.is_approved) {
          ctx.isOwner = false
          ctx.isAuthorized = true
        } else {
          ctx.isOwner = false
          ctx.isAuthorized = false
        }

        ctx.userData = user
      }

      await next()
    })

    this.bot.use(async (ctx, next) => {
      const from = ctx.from ? `${ctx.from.first_name} (@${ctx.from.username || ctx.from.id})` : "unknown"
      console.log(`[${new Date().toLocaleString()}] Message from ${from}`)
      await next()
    })
  }

  async showTyping(ctx) {
    await ctx.sendChatAction("typing")
  }

  async handleApprovalRequest(ctx) {
    const userId = ctx.from.id
    const userName = `${ctx.from.first_name} ${ctx.from.last_name || ""}`.trim()
    const username = ctx.from.username ? `@${ctx.from.username}` : ""

    this.pendingApprovals.set(userId, {
      approved: false,
      pending: true,
      name: userName,
      username: username,
      chatId: ctx.chat.id,
      message: ctx.message
    })

    await this.db.log("pending_approval", userId, { name: userName, username })

    const approvalMessage = `🔔 Permintaan Chat Baru

👤 User: ${userName}
📛 Username: ${username || "Tidak ada"}
🆔 ID: ${userId}
💬 Chat ID: ${ctx.chat.id}

Pesan pertama:
"${ctx.message?.text || ctx.message?.caption || "[Media/Non-text]"}"`

    await ctx.telegram.sendMessage(global.ownid, approvalMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Setujui", callback_data: `approve_${userId}` }],
          [{ text: "❌ Tolak", callback_data: `reject_${userId}` }],
          [{ text: "🚫 Ban", callback_data: `ban_${userId}` }]
        ]
      }
    })

    await ctx.reply(
      "⏳ Permintaan anda sedang menunggu persetujuan dari owner.\n" +
      "Silakan tunggu hingga owner menyetujui permintaan chat anda."
    )
  }

  initializeHandlers() {
    this.bot.start(this.handleStart.bind(this))
    this.bot.help(this.handleHelp.bind(this))
    this.bot.command("reset", this.handleReset.bind(this))
    this.bot.command("status", this.handleStatus.bind(this))
    this.bot.command("session", this.handleSession.bind(this))
    this.bot.command("stats", this.handleStats.bind(this))
    this.bot.command("users", this.handleUsers.bind(this))
    this.bot.command("logs", this.handleLogs.bind(this))
    this.bot.command("tools", this.handleTools.bind(this))
    this.bot.command("platform", this.handlePlatform.bind(this))
    this.bot.command("setplatform", this.handleSetPlatform.bind(this))
    this.bot.command("models", this.handleModels.bind(this))
    this.bot.command("setmodel", this.handleSetModel.bind(this))

    this.bot.action(/^approve_(\d+)/, this.handleApprove.bind(this))
    this.bot.action(/^reject_(\d+)/, this.handleReject.bind(this))
    this.bot.action(/^ban_(\d+)/, this.handleBan.bind(this))
    this.bot.action(/^resetsession/, this.handleResetSessionBtn.bind(this))
    this.bot.action(/^clearlogs/, this.handleClearLogs.bind(this))

    this.bot.on("text", this.handleMessage.bind(this))
  }

  async handleStart(ctx) {
    const welcomeMessage = `🤖 Halo! Saya AI Bot

Saya dilengkapi dengan Gemini AI dan MCP System untuk membantu anda.

Features:
- Chat dengan AI
- MCP Tools (calculator, weather, time, search, curl, exec, dll)
- Download & kirim media (video, foto, file)
- Memory percakapan tersimpan di database
- Reset session

Ketik /help untuk melihat bantuan lebih lanjut.`

    await ctx.reply(welcomeMessage)
  }

  async handleHelp(ctx) {
    const helpMessage = `📖 Bantuan

Commands:
/start - Mulai bot
/help - Tampilkan bantuan ini
/reset - Reset sesi chat anda
/status - Lihat status bot
/session - Info sesi anda
/stats - Statistik bot (owner only)
/users - Daftar users (owner only)
/logs - Lihat logs (owner only)
/tools - Daftar tools MCP
/platform - Lihat/ganti platform (owner only)
/models - Daftar model OpenRouter (owner only)
/setmodel - Ganti model OpenRouter (owner only)

Contoh penggunaan:
- "Hitung 15 + 25"
- "Cuaca di Jakarta"
- "Jam berapa sekarang"
- "https://api.example.com" (akses URL)
- "exec ls -la"
- "baca file package.json"
- "tulis file test.txt isi konten"
- "download video dari https://..."
- "curl ... lalu kirim videonya"

AI akan otomatis menentukan tool yang tepat.`

    await ctx.reply(helpMessage)
  }

  async handleReset(ctx) {
    const userId = ctx.from.id
    await this.ai.resetSession(userId)
    await this.db.clearUserSessions(userId)

    await ctx.reply(
      "✅ Sesi chat anda telah direset.\n" +
      "Memory percakapan telah dibersihkan."
    )

    await this.db.log("reset_session", userId, {})
  }

  async handleStatus(ctx) {
    const sessionInfo = this.ai.getSessionInfo(ctx.from.id)
    const dbSessionCount = await this.db.getSessionCount(ctx.from.id)
    const availableTools = this.mcp.getAvailableTools().join(", ")
    const platform = this.ai.getPlatform()
    const model = this.ai.getModel()

    const statusMessage = `📊 Status Bot

👤 Session Info:
- In-Memory Messages: ${sessionInfo.messageCount}
- Database Sessions: ${dbSessionCount}
- Created: ${sessionInfo.createdAt ? new Date(sessionInfo.createdAt).toLocaleString() : "N/A"}
- Last Active: ${sessionInfo.lastActive ? new Date(sessionInfo.lastActive).toLocaleString() : "N/A"}

🤖 AI Platform: ${platform}
📦 Model: ${model}

🔧 MCP Tools: ${availableTools}`

    await ctx.reply(statusMessage)
  }

  async handleSession(ctx) {
    const sessions = await this.db.getUserSessions(ctx.from.id, 10)

    if (sessions.length === 0) {
      await ctx.reply("❌ Tidak ada sesi tersimpan.")
      return
    }

    let sessionText = "📋 10 Sesi Terakhir Anda\n\n"
    sessions.forEach((s, i) => {
      const msg = s.message.length > 30 ? s.message.substring(0, 30) + "..." : s.message
      sessionText += `${i + 1}. ${msg}\n`
    })

    await ctx.reply(sessionText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Reset Session", callback_data: "resetsession" }]
        ]
      }
    })
  }

  async handleStats(ctx) {
    if (!ctx.isOwner) {
      await ctx.reply("❌ Command ini hanya untuk owner.")
      return
    }

    const stats = await this.db.getStats()
    const availableTools = this.mcp.getAvailableTools().length

    const statsMessage = `📊 Bot Statistics

👥 Users:
- Total: ${stats.totalUsers}
- Approved: ${stats.approvedUsers}
- Pending: ${stats.totalUsers - stats.approvedUsers}

💬 Sessions: ${stats.totalSessions}
📝 Logs: ${stats.totalLogs}
🔧 Tools: ${availableTools}

Uptime: ${process.uptime().toFixed(2)}s
Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`

    await ctx.reply(statsMessage)
  }

  async handleUsers(ctx) {
    if (!ctx.isOwner) {
      await ctx.reply("❌ Command ini hanya untuk owner.")
      return
    }

    const users = await this.db.getAllUsers()

    if (users.length === 0) {
      await ctx.reply("❌ Belum ada user.")
      return
    }

    let usersText = `👥 Daftar Users (${users.length})\n\n`
    users.forEach((u, i) => {
      const name = `${u.first_name} ${u.last_name || ""}`.trim()
      const status = u.is_banned ? "🚫 Banned" : u.is_approved ? "✅ Approved" : "⏳ Pending"
      usersText += `${i + 1}. ${name} (@${u.username || "-"}) - ${status}\n`
    })

    await ctx.reply(usersText)
  }

  async handleLogs(ctx) {
    if (!ctx.isOwner) {
      await ctx.reply("❌ Command ini hanya untuk owner.")
      return
    }

    const logs = await this.db.getLogs(20)

    if (logs.length === 0) {
      await ctx.reply("❌ Belum ada logs.")
      return
    }

    let logsText = "📝 Recent Logs (20 terakhir)\n\n"
    logs.forEach((l, i) => {
      const time = new Date(l.created_at).toLocaleString()
      logsText += `${i + 1}. [${time}] ${l.event_type} (User: ${l.user_id || "-"})\n`
    })

    await ctx.reply(logsText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗑️ Clear Logs", callback_data: "clearlogs" }]
        ]
      }
    })
  }

  async handleTools(ctx) {
    const tools = this.mcp.getAvailableTools()

    let toolsText = "🔧 Daftar MCP Tools\n\n"
    tools.forEach((t, i) => {
      toolsText += `${i + 1}. ${t}\n`
    })

    toolsText += "\nAI akan otomatis memilih tool yang tepat."

    await ctx.reply(toolsText)
  }

  async handlePlatform(ctx) {
    if (!ctx.isOwner) {
      await ctx.reply("❌ Command ini hanya untuk owner.")
      return
    }

    const currentPlatform = global.platfrom
    const currentModel = global.platfrom === "gemini" ? global.gemini.model : global.openrouter_config.model

    let platformText = `🤖 AI Platform Settings

Platform saat ini: ${currentPlatform}
Model saat ini: ${currentModel}

Pilih platform:
1. gemini - Google Gemini API
2. openrouter - OpenRouter API (multi-provider)

Ketik:
/platform gemini - Ganti ke Gemini
/platform openrouter - Ganti ke OpenRouter`

    await ctx.reply(platformText)
  }

  async handleSetPlatform(ctx) {
    if (!ctx.isOwner) {
      await ctx.reply("❌ Command ini hanya untuk owner.")
      return
    }

    const args = ctx.message.text.split(" ").slice(1)
    const newPlatform = args[0]?.toLowerCase()

    if (!newPlatform || !["gemini", "openrouter"].includes(newPlatform)) {
      await ctx.reply(
        "❌ Platform tidak valid!\n\n" +
        "Gunakan: /platform <gemini|openrouter>\n" +
        "Contoh: /platform gemini"
      )
      return
    }

    global.platfrom = newPlatform
    global.ai.platfrom = newPlatform
    global.ai.model = newPlatform === "gemini" ? global.gemini.model : global.openrouter_config.model

    this.ai = new (require("./lib/logic.js"))()

    await ctx.reply(
      `✅ Platform berhasil diganti ke ${newPlatform}!\n\n` +
      `Model: ${global.ai.model}\n\n` +
      `AI instance telah direload.`
    )

    await this.db.log("platform_change", ctx.from.id, { platform: newPlatform })
  }

  async handleModels(ctx) {
    if (!ctx.isOwner) {
      await ctx.reply("❌ Command ini hanya untuk owner.")
      return
    }

    if (global.platfrom !== "openrouter") {
      await ctx.reply("❌ Command ini hanya tersedia saat menggunakan OpenRouter.\n\nGunakan /platform openrouter untuk beralih.")
      return
    }

    await ctx.reply("🔄 Mengambil daftar model dari OpenRouter...")

    try {
      const models = await this.ai.getOpenRouterModels()
      
      if (models.length === 0) {
        await ctx.reply("❌ Tidak ada model yang ditemukan.")
        return
      }

      const byProvider = models.reduce((acc, m) => {
        const provider = m.id.split("/")[0]
        if (!acc[provider]) acc[provider] = []
        acc[provider].push(m.id)
        return acc
      }, {})

      let text = `📦 Daftar Model OpenRouter (${models.length} total)\n\n`
      
      for (const [provider, modelList] of Object.entries(byProvider)) {
        text += `🔹 ${provider.toUpperCase()} (${modelList.length})\n`
        modelList.slice(0, 10).forEach(m => {
          text += `  • ${m}\n`
        })
        if (modelList.length > 10) {
          text += `  ... dan ${modelList.length - 10} lainnya\n`
        }
        text += "\n"
      }

      text += `\nGunakan /setmodel <model_id> untuk mengganti model`

      await ctx.reply(text.substring(0, 4000))
    } catch (error) {
      await ctx.reply(`❌ Error: ${error.message}`)
    }
  }

  async handleSetModel(ctx) {
    if (!ctx.isOwner) {
      await ctx.reply("❌ Command ini hanya untuk owner.")
      return
    }

    if (global.platfrom !== "openrouter") {
      await ctx.reply("❌ Command ini hanya tersedia saat menggunakan OpenRouter.")
      return
    }

    const args = ctx.message.text.split(" ").slice(1)
    const newModel = args.join(" ")

    if (!newModel) {
      await ctx.reply("❌ Format tidak valid!\n\nGunakan: /setmodel <model_id>\nContoh: /setmodel google/gemma-2-9b-it:free")
      return
    }

    global.openrouter_config.model = newModel
    global.ai.model = newModel

    this.ai = new (require("./lib/logic.js"))()

    await ctx.reply(
      `✅ Model berhasil diganti!\n\n` +
      `Model: ${newModel}\n\n` +
      `AI instance telah direload.`
    )

    await this.db.log("model_change", ctx.from.id, { model: newModel })
  }

  async handleApprove(ctx) {
    const userId = parseInt(ctx.match[1])
    const pending = this.pendingApprovals.get(userId)

    if (pending) {
      this.pendingApprovals.set(userId, { ...pending, approved: true, pending: false })
      await this.db.approveUser(userId)
      await this.db.log("user_approved", userId, {})

      await ctx.editMessageText(
        `✅ User ${pending.name} telah disetujui.\n` +
        `Sekarang mereka dapat chat dengan bot.`
      )

      try {
        await ctx.telegram.sendMessage(
          pending.chatId,
          `✅ Permintaan anda telah disetujui!\n\n` +
          `Silakan mulai chat dengan bot.\n` +
          `Ketik /start untuk memulai.`
        )
      } catch (e) {
        console.error("Failed to notify user:", e.message)
      }
    }

    await ctx.answerCbQuery()
  }

  async handleReject(ctx) {
    const userId = parseInt(ctx.match[1])
    const pending = this.pendingApprovals.get(userId)

    if (pending) {
      this.pendingApprovals.delete(userId)
      await this.db.rejectUser(userId)
      await this.db.log("user_rejected", userId, {})

      await ctx.editMessageText(
        `❌ User ${pending.name} telah ditolak.`
      )

      try {
        await ctx.telegram.sendMessage(
          pending.chatId,
          `❌ Permintaan anda ditolak oleh owner.`
        )
      } catch (e) {
        console.error("Failed to notify user:", e.message)
      }
    }

    await ctx.answerCbQuery()
  }

  async handleBan(ctx) {
    const userId = parseInt(ctx.match[1])
    const pending = this.pendingApprovals.get(userId)

    if (pending) {
      this.pendingApprovals.delete(userId)
      await this.db.banUser(userId)
      await this.db.log("user_banned", userId, {})

      await ctx.editMessageText(
        `🚫 User ${pending.name} telah di-banned.`
      )

      try {
        await ctx.telegram.sendMessage(
          pending.chatId,
          `🚫 Anda telah di-banned dari bot ini.`
        )
      } catch (e) {
        console.error("Failed to notify user:", e.message)
      }
    }

    await ctx.answerCbQuery()
  }

  async handleResetSessionBtn(ctx) {
    const userId = ctx.from.id
    await this.ai.resetSession(userId)
    await this.db.clearUserSessions(userId)

    await ctx.editMessageText(
      "✅ Session telah direset!\n" +
      "Memory percakapan telah dibersihkan."
    )

    await ctx.answerCbQuery()
  }

  async handleClearLogs(ctx) {
    if (!ctx.isOwner) {
      await ctx.answerCbQuery()
      return
    }

    await this.db.clearLogs()
    await this.db.log("logs_cleared", ctx.from.id, {})

    await ctx.editMessageText(
      "🗑️ Logs telah dibersihkan."
    )

    await ctx.answerCbQuery()
  }

  async downloadFile(url) {
    return new Promise((resolve) => {
      const tempFile = path.join(__dirname, "temp", `download_${Date.now()}`)
      
      if (!fs.existsSync(path.join(__dirname, "temp"))) {
        fs.mkdirSync(path.join(__dirname, "temp"))
      }

      const client = url.startsWith("https") ? https : http
      
      client.get(url, (res) => {
        const file = fs.createWriteStream(tempFile)
        res.pipe(file)
        
        file.on("finish", () => {
          file.close()
          resolve(tempFile)
        })
      }).on("error", (err) => {
        fs.unlink(tempFile, () => {})
        resolve({ error: err.message })
      })
    })
  }

  async handleMessage(ctx) {
    if (!ctx.isAuthorized) {
      if (ctx.message && ctx.message.text && !ctx.message.text.startsWith("/")) {
        await this.handleApprovalRequest(ctx)
      }
      return
    }

    if (!ctx.message || !ctx.message.text) {
      return
    }

    if (ctx.message.text.startsWith("/")) {
      return
    }

    const userId = ctx.from.id
    const message = ctx.message.text

    console.log(`User ${userId} bertanya: ${message}`)

    await this.showTyping(ctx)

    // Create AI functions instance with ctx
    const aiFunctions = new AIFunctions(ctx, this.db)
    
    // Bind functions for AI to call
    const functionsForAI = {
      sendVideoByUrl: aiFunctions.sendVideoByUrl.bind(aiFunctions),
      sendPhotoByUrl: aiFunctions.sendPhotoByUrl.bind(aiFunctions),
      sendFileByUrl: aiFunctions.sendFileByUrl.bind(aiFunctions),
      deleteFileByPath: aiFunctions.deleteFileByPath.bind(aiFunctions),
      writeFileByPath: aiFunctions.writeFileByPath.bind(aiFunctions),
      readFileByPath: aiFunctions.readFileByPath.bind(aiFunctions),
      listDirectory: aiFunctions.listDirectory.bind(aiFunctions),
      executeCommand: aiFunctions.executeCommand.bind(aiFunctions),
      runJavaScript: aiFunctions.runJavaScript.bind(aiFunctions)
    }

    const result = await this.ai.processWithAI(userId, message, this.mcp, functionsForAI)

    if (result.toolsUsed) {
      console.log(`Tools used: ${result.toolResults.map(t => t.tool).join(", ")}`)
    }

    if (result.functionCalls.length > 0) {
      console.log(`Function calls executed: ${result.functionCalls.length}`)
      result.functionResults.forEach(fn => {
        console.log(`  - ${fn.function}: ${fn.success ? "Success" : "Error: " + fn.error}`)
      })
    }

    if (result.success) {
      await ctx.reply(result.text)

      await this.db.saveSession(
        userId,
        message,
        result.text,
        result.toolsUsed ? result.toolResults.map(t => t.tool).join(", ") : null,
        result.toolResults
      )

      await this.db.log("message", userId, {
        message,
        toolsUsed: result.toolsUsed,
        functionCalls: result.functionCalls.length
      })
    } else {
      await ctx.reply(
        "⚠️ Maaf, terjadi kesalahan saat memproses permintaan anda.\n" +
        `Error: ${result.error}`
      )

      await this.db.log("error", userId, { error: result.error })
    }
  }

  async launch() {
    console.log("🤖 Bot launching...")
    await this.bot.launch()
    console.log(`✅ Bot online! (@${this.bot.botInfo?.username || "unknown"})`)

    setInterval(() => {
      this.ai.clearExpiredSessions()
    }, 3600000)

    process.once("SIGINT", () => this.stop("SIGINT"))
    process.once("SIGTERM", () => this.stop("SIGTERM"))
  }

  async stop(reason) {
    console.log(`🛑 Bot stopping... (${reason})`)
    this.db.close()
    await this.bot.stop()
    console.log("✅ Bot stopped.")
    process.exit(0)
  }
}

module.exports = Agent
