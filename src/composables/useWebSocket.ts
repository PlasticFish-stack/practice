import { getCurrentScope, onScopeDispose } from 'vue'

type WebSocketOptions = {
  reconnectInterval?: number
  maxReconnectAttempts?: number
  pingInterval?: number
  pingTimeout?: number
  heartbeatMessage?: string
}

type EventType = keyof WebSocketEventMap
type Listener<K extends EventType> = (event: WebSocketEventMap[K], socket: WebSocket) => void
type Message = Parameters<WebSocket['send']>[0]
type Timer = ReturnType<typeof setTimeout>

export function useWebSocket(url: string, options: WebSocketOptions = {}) {
  const {
    reconnectInterval = 5000,
    maxReconnectAttempts = 3,
    pingInterval = 30000,
    pingTimeout = 5000,
    heartbeatMessage = '- -',
  } = options

  let client: WebSocket | null = null
  let stopped = true
  let attempts = 0
  let reconnectTimer: Timer | undefined
  let heartbeatTimer: Timer | undefined
  const sendQueue: Message[] = []
  const listeners: { [K in EventType]: Set<Listener<K>> } = {
    open: new Set(),
    message: new Set(),
    close: new Set(),
    error: new Set(),
  }

  function addEventListener<K extends EventType>(type: K, fn: Listener<K>) {
    const bucket = listeners[type] as Set<Listener<K>>
    // 每次注册都有独立的取消函数，即使传入同一个回调。
    const listener: Listener<K> = (event, socket) => fn(event, socket)
    bucket.add(listener)
    return () => { bucket.delete(listener) }
  }

  function emit<K extends EventType>(type: K, event: WebSocketEventMap[K], socket: WebSocket) {
    const bucket = listeners[type] as Set<Listener<K>>
    for (const listener of [...bucket]) {
      if (!bucket.has(listener)) continue
      try {
        listener(event, socket)
      } catch (error) {
        console.error('WebSocket 回调执行失败', error)
      }
    }
  }

  function stopHeartbeat() {
    clearTimeout(heartbeatTimer)
    heartbeatTimer = undefined
  }

  // 任意入站消息都视为存活信号；pingInterval <= 0 时禁用心跳。
  function startHeartbeat(socket: WebSocket) {
    stopHeartbeat()
    if (pingInterval <= 0) return
    heartbeatTimer = setTimeout(() => {
      if (client !== socket || socket.readyState !== WebSocket.OPEN) return
      socket.send(heartbeatMessage)
      heartbeatTimer = setTimeout(() => {
        if (client === socket) socket.close()
      }, pingTimeout)
    }, pingInterval)
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer !== undefined || attempts >= maxReconnectAttempts) return
    const delay = Math.min(reconnectInterval * 2 ** attempts++, 30000)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      if (!stopped) openSocket()
    }, delay)
  }

  function flushQueue() {
    if (client?.readyState !== WebSocket.OPEN) return
    // 按顺序发送，避免每次 shift() 都移动整个数组。
    let sent = 0
    try {
      for (const message of sendQueue) {
        client.send(message)
        sent++
      }
    } finally {
      sendQueue.splice(0, sent)
    }
  }

  function openSocket() {
    let socket: WebSocket
    try {
      socket = new WebSocket(url)
    } catch (error) {
      console.error('WebSocket 创建失败', error)
      scheduleReconnect()
      return
    }
    client = socket

    socket.onopen = (event) => {
      if (client !== socket) return
      attempts = 0
      startHeartbeat(socket)
      flushQueue()
      emit('open', event, socket)
    }
    socket.onmessage = (event) => {
      if (client !== socket) return
      startHeartbeat(socket)
      emit('message', event, socket)
    }
    socket.onclose = (event) => {
      if (client !== socket) return
      client = null
      stopHeartbeat()
      scheduleReconnect()
      emit('close', event, socket)
    }
    socket.onerror = (event) => {
      if (client === socket) emit('error', event, socket)
    }
  }

  function connect() {
    if (client && client.readyState !== WebSocket.CLOSED) return
    stopped = false
    attempts = 0
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    openSocket()
  }

  // 主动关闭会清空待发消息，保留订阅，便于再次 connect()。
  function close() {
    stopped = true
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    stopHeartbeat()
    sendQueue.length = 0
    const socket = client
    client = null
    socket?.close()
  }

  function sendMessage(data: Message) {
    sendQueue.push(data)
    flushQueue()
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      close()
      for (const bucket of Object.values(listeners)) bucket.clear()
    })
  }

  return { connect, close, addEventListener, sendMessage }
}
