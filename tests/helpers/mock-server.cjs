const { createServer } = require('node:http')
const { once } = require('node:events')
const { createLoader } = require('./load-ts.cjs')

async function mockServer() {
  const handle = createLoader()('mock/server.ts').createMockApi()
  const server = createServer((req, res) => {
    void handle(req, res, () => { res.statusCode = 404; res.end() }).catch(error => { res.statusCode = 500; res.end(JSON.stringify({ message: error.message })) })
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  function client() {
    const cookies = new Map()
    return {
      async request(path, method = 'GET', data) {
        const headers = { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), 'Content-Type': 'application/json', Origin: base }
        if (cookies.has('XSRF-TOKEN')) headers['X-XSRF-TOKEN'] = cookies.get('XSRF-TOKEN')
        const response = await fetch(base + path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) })
        for (const cookie of response.headers.getSetCookie()) { const [key, value] = cookie.split(';')[0].split('='); cookies.set(key, value) }
        return { status: response.status, ...(await response.json()) }
      },
      async login(username, password = 'Demo@123456') {
        await this.request('/api/auth/csrf')
        return this.request('/api/auth/login', 'POST', { username, password })
      },
    }
  }
  return { client, close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } }
}
module.exports = { mockServer }
