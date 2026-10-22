import { onScopeDispose } from "vue"

type WebSocketOptions = {
  reconnectInterval: number,
  maxReconnectAttempts: number,
  pingInterval: number
}

type FnTypeStrict<K extends keyof WebSocketEventMap> = (
  event: WebSocketEventMap[K],
  socket: WebSocket
) => void

// 只保存回调的身份，不通过这个类型调用回调。
type ListenerRef = (...args: never[]) => unknown

type ListenerRecord = {
  cancel: () => void
  bind: (socket: WebSocket) => void
}

type State = | 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'stopped'

type TranistionsStateMap = Record<State, State[]>

type ReconnectType = {
  attempts: number //重连已连接次数
  interval: number //指数重连时间间隔
  maxAttempts: number //最大连接次数
  timer: ReturnType<typeof setTimeout> | null, //重连定时器
  clearTimer: () => void,
  resetAttempts: () => void
  start: () => void
}



export function useWebsocket(url: string, options?: WebSocketOptions) {
  const { CONNECTING, OPEN, CLOSED, CLOSING } = WebSocket

  let client: WebSocket | null = null

  let connectState: State = 'idle'

  function tranistion(nextState: State): boolean {
    const tranistionsMap: TranistionsStateMap = {
      'idle': ['connecting'],
      'connecting': ['connected', 'stopped'],
      'connected': ['stopped'],
      'reconnecting': ['connecting', 'stopped'],
      'stopped': ['connecting', 'reconnecting', 'idle']
    }
    const allowed = tranistionsMap[connectState]
    if (!allowed.includes(nextState)) return false
    connectState = nextState
    return true
  }

  const eventBuckets = new WeakMap<ListenerRef, Record<string, keyof WebSocketEventMap>>()
  const eventListenCancel = new Map<string, ListenerRecord>()
  const activeEventListenUUID = new Set<string>()

  const reconnect: ReconnectType = {
    attempts: 0, //重连次数
    timer: null,//重连定时器
    interval: 5000, //重连时间间隔
    maxAttempts: 3,//最大连接次数

    clearTimer() {
      if (this.timer !== null) {
        clearTimeout(this.timer)
        this.timer = null
      }
    },

    resetAttempts() {
      this.attempts = 0
    },

    start() {
      if (this.attempts === this.maxAttempts) return
      if (!tranistion('reconnecting')) return
      const delay = Math.min(
        this.interval * 2 ** this.attempts,
        30_000,
      )
      console.warn(`准备第${this.attempts + 1}次重连`);
      this.attempts++
      this.timer = setTimeout(() => {
        client = null
        connect(true)
      }, delay)
    }
  }



  function connect(isReconnecting: boolean = false) {
    if (!tranistion('connecting')) return
    const socket = new WebSocket(url)
    _clientEvent(socket)
    if (isReconnecting) {
      for (const listener of eventListenCancel.values()) {
        listener.bind(socket)
      }
    }
    client = socket
    reconnect.resetAttempts()
  }

  function close() {
    if (!client) return
    if (!tranistion('stopped')) return

    reconnect.attempts = reconnect.maxAttempts

    heartbeat.stop()
    removeEventListener()
    client.close()
    client = null
    if (!tranistion('idle')) return
  }



  function _clientEvent(socket: WebSocket) {
    socket.onopen = () => {
      if (client !== socket) return
      tranistion('connected')
      executiveSendQueue()
      heartbeat.start(socket, '- -')
    }
    socket.onmessage = () => {
      if (client !== socket) return
      heartbeat.clearPingTimeout()

      heartbeat.start(socket, '- -')
    }
    socket.onclose = () => {
      if (client !== socket) return
      if (!tranistion('stopped')) return
      heartbeat.stop()
      client.close()
      client = null
      if (reconnect.attempts < reconnect.maxAttempts) {
        reconnect.start()
      }
    }
    socket.onerror = (e) => {
      console.error("error", e);

    }
  }

  type HeartbeatType = {
    intervalEvent: ReturnType<typeof setInterval> | null
    timer: ReturnType<typeof setTimeout> | null,
    pingInterval: number, //ping时间间隔
    pingTimeout: number,
    start: (socket: WebSocket, heartbeatMsg: string) => void
    stop: () => void,
    clearPingTimeout: () => void
  }

  const heartbeat: HeartbeatType = {
    intervalEvent: null,
    timer: null,
    pingInterval: options?.pingInterval ?? 30000, //ping时间间隔
    pingTimeout: 5000,

    start(socket: WebSocket, msg: string) {
      if (!socket) return
      if (client !== socket) return
      this.stop()
      this.intervalEvent = setInterval(() => {
        socket.send(msg)
        this.timer = setTimeout(() => {
          socket.close()
        }, this.pingTimeout)
      }, this.pingInterval)
    },

    stop() {
      if (heartbeat.intervalEvent !== null) {
        clearInterval(heartbeat.intervalEvent)
        heartbeat.intervalEvent = null
      }
      this.clearPingTimeout()
    },

    clearPingTimeout() {
      if (heartbeat.timer !== null) {
        clearTimeout(heartbeat.timer)
        heartbeat.timer = null
      }
    }
  }

  function addEventListener<K extends keyof WebSocketEventMap>(type: K, fn: FnTypeStrict<K>) {
    if (!client) return
    let socket = client
    let copyFn: FnTypeStrict<K> | null = fn
    const wrapper = (e: WebSocketEventMap[K]) => copyFn?.(e, socket)
    const uuid = crypto.randomUUID()
    const cancel = () => {
      if (!copyFn) return
      const cancelBuckets = eventBuckets.get(copyFn)
      socket.removeEventListener(type, wrapper)
      eventListenCancel.delete(uuid)
      activeEventListenUUID.delete(uuid)
      if (cancelBuckets) {
        delete cancelBuckets[uuid]
        if (Object.keys(cancelBuckets).length === 0) {
          eventBuckets.delete(copyFn)
        }
      }
      copyFn = null
    }

    const bind = (nextSocket: WebSocket) => {
      if (!copyFn) return
      socket.removeEventListener(type, wrapper)
      socket = nextSocket
      socket.addEventListener(type, wrapper)
      activeEventListenUUID.add(uuid)
    }

    const uuidBuckets = eventBuckets.get(copyFn) ?? {} //uuid
    {
      uuidBuckets[uuid] = type
      eventBuckets.set(copyFn, uuidBuckets)
    } //填充eventBuckets
    socket.addEventListener(type, wrapper)
    activeEventListenUUID.add(uuid) //现在活跃的uuid列表
    eventListenCancel.set(uuid, { cancel, bind })
    return cancel
  }

  function removeEventListener() {
    if (!client) return
    activeEventListenUUID.forEach((uuid) => {
      const fn = eventListenCancel.get(uuid)
      if (!fn) return
      const { cancel } = fn
      cancel()
    })
  }

  const sendQueue: any[] = []



  function clearSendQueue() {
    sendQueue.length = 0
  }

  function sendMessage(data: BufferSource | Blob | string) {
    if (!client) return
    const socket = client
    if (socket.readyState !== OPEN) {
      sendQueue.push(data)
      return
    }
    socket.send(data)
  }


  function executiveSendQueue() {
    if (sendQueue.length > 0) {
      while (sendQueue.length > 0) {
        sendMessage(sendQueue[0])
        sendQueue.shift()
      }
    }
  }


  onScopeDispose(() => {

  })

  return {
    connect, close, addEventListener, sendMessage
  }
}



