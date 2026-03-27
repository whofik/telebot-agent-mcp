# Telegraf Gemini MCP Bot

Telegram bot dengan AI (Gemini/OpenRouter) dan MCP (Model Context Protocol) system yang memungkinkan AI untuk execute function secara otomatis.

## Features

- 🤖 **AI-Powered** - Menggunakan Gemini API atau OpenRouter API
- 🔧 **MCP System** - 19 tools yang bisa dipanggil oleh AI
- 🎬 **Auto Send Media** - Kirim video, foto, file dari URL
- 💾 **Database** - SQLite untuk menyimpan sessions, users, logs
- 🔐 **Approval System** - User baru butuh persetujuan owner
- 🔄 **Function Calling** - AI bisa call function secara otomatis
- 📊 **Multi-Platform** - Support Gemini dan OpenRouter

## MCP Tools

### AI Functions
1. `sendVideoByUrl(url, caption)` - Kirim video dari URL
2. `sendPhotoByUrl(url, caption)` - Kirim foto dari URL
3. `sendFileByUrl(url, caption)` - Kirim file dari URL
4. `deleteFileByPath(path)` - Hapus file
5. `writeFileByPath(path, content)` - Tulis file
6. `readFileByPath(path)` - Baca file
7. `listDirectory(path)` - List isi folder
8. `executeCommand(command)` - Execute shell command
9. `runJavaScript(code)` - Execute JavaScript code

### MCP Tools
- `calculator` - Perhitungan matematika
- `weather` - Info cuaca
- `time` - Waktu dan tanggal
- `search` - Pencarian informasi
- `curl/fetch` - HTTP request
- Dan masih banyak lagi...

## Installation

```bash
# Clone repository
git clone https://github.com/yourusername/telegraf-gemini-mcp-bot.git
cd telegraf-gemini-mcp-bot

# Install dependencies
npm install
```

## Configuration

Edit `settings.js`:

```javascript
global.token = "BOT_TOKEN_DARI_BOTFATHER"
global.ownid = "TELEGRAM_ID_ANDA"  // angka

// Pilih platform: "gemini" atau "openrouter"
global.platfrom = "gemini"

// Gemini Configuration
global.gemini = {
  apikey: "AIzaSy...",  // Gemini API Key
  model: "gemini-2.0-flash-exp"
}

// OpenRouter Configuration
global.openrouter = {
  apikey: "sk-or-v1-..."  // OpenRouter API Key
}

global.openrouter_config = {
  model: "google/gemini-2.0-flash-exp",
  temperature: 0.7,
  max_tokens: 2000
}
```

## Usage

### Start Bot

```bash
npm start
```

### Bot Commands

**User Commands:**
- `/start` - Mulai bot
- `/help` - Tampilkan bantuan
- `/reset` - Reset sesi chat

**Owner Commands:**
- `/stats` - Statistik bot
- `/users` - Daftar users
- `/logs` - Lihat logs
- `/platform` - Lihat/ganti platform
- `/models` - Daftar model OpenRouter
- `/setmodel` - Ganti model

### Examples

**Chat dengan AI:**
```
hai
```

**Execute Command:**
```
exec ls -la
```

**Curl API dan Kirim Video:**
```
curl https://api.example.com/video
ambil video nya kirim ke sini
```

**Execute JavaScript:**
```javascript
console.log("Hello World")
```

**Write File:**
```
tulis file test.txt isi nya hello world
```

**Read File:**
```
baca file package.json
```

## Function Calling

AI bisa call function secara otomatis dengan format:

```
[CALL: functionName("param1" "param2")]
```

Contoh response AI:
```
Oke udah saya curl API nya Dapet video TikTok nih Saya kirim ya
[CALL: sendVideoByUrl("https://example.com/video.mp4" "Video TikTok dari API")]
```

## Project Structure

```
telegraf-gemini-mcp-bot/
├── index.js              # Entry point
├── settings.js           # Configuration
├── agent.js              # Main bot logic
├── package.json          # Dependencies
├── database/
│   ├── manager.js        # Database manager
│   └── bot.json          # Database file
├── lib/
│   ├── connector.js      # MCP connector
│   ├── logic.js          # AI logic
│   └── function.js       # AI functions
└── temp/                 # Temporary files
```

## Getting API Keys

### Telegram Bot Token
1. Chat dengan [@BotFather](https://t.me/BotFather)
2. Kirim `/newbot`
3. Ikuti instruksi
4. Copy token

### Gemini API Key
1. Buka [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Login dengan Google account
3. Create API key
4. Copy key

### OpenRouter API Key
1. Buka [OpenRouter](https://openrouter.ai/keys)
2. Login/Register
3. Create new key
4. Copy key

## Owner ID

Dapatkan Telegram ID anda:
1. Chat dengan [@userinfobot](https://t.me/userinfobot)
2. Bot akan reply dengan ID anda
3. Copy ID (angka)

## License

ISC

## Support

Jika ada masalah atau pertanyaan, silakan buat issue di GitHub.

## Credits

- [Telegraf](https://telegraf.js.org/) - Telegram bot framework
- [Gemini API](https://ai.google.dev/) - AI model
- [OpenRouter](https://openrouter.ai/) - Multi-provider AI
