#!/usr/bin/env node

const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')

const PORT = process.env.PORT || 8080
const DIST_DIR = path.join(__dirname, 'dist')
const BASE_PATH = '/keep/'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404)
      res.end('File not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    })
    res.end(content)
  })
}

const server = http.createServer((req, res) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    })
    res.end()
    return
  }

  // 解析请求路径 (使用 WHATWG URL API)
  let reqPath = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname || '/'

  // 如果请求路径以 /keep/ 开头，去掉此前缀（兼容 GitHub Pages 构建）
  if (reqPath.startsWith(BASE_PATH)) {
    reqPath = reqPath.slice(BASE_PATH.length - 1) // 保留开头的 /
  }

  // 构建本地文件路径
  let filePath = path.join(DIST_DIR, reqPath === '/' ? 'index.html' : reqPath)

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err || stats.isDirectory()) {
      // SPA fallback: 不存在的路径返回 index.html
      filePath = path.join(DIST_DIR, 'index.html')
    }

    serveFile(res, filePath)
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
