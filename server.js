#!/usr/bin/env node

const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')

const PORT = process.env.PORT || 8080
const DIST_DIR = path.join(__dirname, 'dist')

const server = http.createServer((req, res) => {
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url)

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // Serve index.html for SPA routes
  fs.stat(filePath, (err, stats) => {
    if (err || stats.isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html')
    }

    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    }

    const contentType = mimeTypes[ext] || 'application/octet-stream'

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404)
        res.end('File not found')
        return
      }

      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
    })
  })
})

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🤖 Iron Man 3D Motion Capture System                   ║
║   ✨ Server running!                                      ║
║                                                           ║
║   📱 Open in your browser:                               ║
║   👉 http://localhost:${PORT}                             ║
║                                                           ║
║   ⚠️  Allow camera access when browser asks              ║
║   🎮 Use hand gestures to interact with 3D objects      ║
╚═══════════════════════════════════════════════════════════╝
  `)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`)
    process.exit(1)
  } else {
    throw err
  }
})
