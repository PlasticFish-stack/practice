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

type TranistionsState = 'connecting' | 'connected' | 'reconnecting' | 'stopped'

type TranistionsStateMap = Record<TranistionsState, State[]>

type ReconnectType = {
  attempts: number //重连已连接次数
  interval: number //指数重连时间间隔
  maxAttempts: number //最大连接次数
  timer: ReturnType<typeof setTimeout> | null //重连定时器
}

type HeartbeatType = {
  intervalEvent: ReturnType<typeof setInterval> | null
  timer: ReturnType<typeof setTimeout> | null,
  pingInterval: number, //ping时间间隔
  pingTimeout: number,
}

export function useWebsocket(url: string, options?: WebSocketOptions) {
  let client: WebSocket | null = null
  let connectTimeout = 10000 //连接超时时间

  const eventBuckets = new WeakMap<ListenerRef, Record<string, keyof WebSocketEventMap>>()
  const eventListenCancel = new Map<string, ListenerRecord>()
  const activeEventListenUUID = new Set<string>()


  const reconnect: ReconnectType = {
    attempts: 0, //重连次数
    timer: null,//重连定时器
    interval: 5000, //重连时间间隔
    maxAttempts: 3//最大连接次数
  }

  const { CONNECTING, OPEN, CLOSED, CLOSING } = WebSocket


  function _clearReconnectTimer() {
    if (reconnect['timer'] !== null) {
      clearTimeout(reconnect['timer'])
      reconnect['timer'] = null
    }
  }

  let connectState: State = 'idle'

  function tranistion(nextState: TranistionsState): boolean {
    const tranistionsMap: TranistionsStateMap = {
      'connecting': ['idle', 'stopped'],
      'connected': ['connecting', 'reconnecting'],
      'reconnecting': ['connecting', 'connected', 'stopped'],
      'stopped': ['connecting', 'reconnecting', 'connected']
    }

    const allowed = tranistionsMap[nextState]
    if (!allowed.includes(connectState)) return false
    connectState = nextState


    switch (nextState) {
      case 'connecting':
        _clearReconnectTimer()
        break
      case 'connected':
        _clearReconnectTimer()
        reconnect['attempts'] = 0


        break
      case 'reconnecting':
        _clearReconnectTimer()
        break
      case 'stopped':
        _clearReconnectTimer()
        _clearHeartbeat()
        break
      default:
        break
    }
    return true
  }

  function connect() {
    if (!tranistion('connecting')) return
    const socket = new WebSocket(url)
    _clientEvent(socket)
    client = socket
  }

  function _reconnect(socket: WebSocket) {
    if (reconnect.attempts === reconnect.maxAttempts) {
      console.warn("超出重试次数");
      tranistion('stopped')
      return
    }
    const delay = Math.min(
      reconnect.interval * 2 ** reconnect.attempts,
      30_000,
    )
    console.warn(`准备第${reconnect.maxAttempts - reconnect.attempts + 1}次重连`);
    reconnect.attempts++
    reconnect.timer = setTimeout(() => {
      const socket = new WebSocket(url)
      _clientEvent(socket)
      for (const listener of eventListenCancel.values()) {
        listener.bind(socket)
      }
      client = socket
    }, delay)
  }



  function _clientEvent(socket: WebSocket) {
    socket.onopen = () => {
      if (client !== socket) return
      tranistion('connected')
      executiveSendQueue()
      _heartbeat(socket, '- -')
    }
    socket.onmessage = () => {
      if (client !== socket) return
      _heartbeat(socket, '- -')
    }
    socket.onclose = () => {
      if (client !== socket) return
      if (!tranistion('stopped')) return
      if (reconnect.attempts < reconnect.maxAttempts) {
        if (!tranistion('reconnecting')) return
        _reconnect(socket)
      }
    }
    socket.onerror = () => {
      if (!tranistion('stopped')) return
      if (reconnect.attempts < reconnect.maxAttempts) {
        if (!tranistion('reconnecting')) return
        _reconnect(socket)
      }
    }
  }


  const heartbeat: HeartbeatType = {
    intervalEvent: null,
    timer: null,
    pingInterval: options?.pingInterval ?? 30000, //ping时间间隔
    pingTimeout: 5000,
  }

  function _heartbeat(socket: WebSocket, heartbeatMsg: string) {
    if (!socket) return
    if (client !== socket) return
    _clearHeartbeat()
    heartbeat.intervalEvent = setInterval(() => {
      socket.send(heartbeatMsg)
      heartbeat.timer = setTimeout(() => {
        socket.close()
      }, heartbeat.pingTimeout)
    }, heartbeat.pingInterval)
  }

  function _clearHeartbeat() {
    if (heartbeat.intervalEvent !== null) {
      clearInterval(heartbeat.intervalEvent)
      heartbeat.intervalEvent = null
    }
    if (heartbeat.timer !== null) {
      clearTimeout(heartbeat.timer)
      heartbeat.timer = null
    }
  }


  function close(socket: WebSocket, isReconnect: boolean = false) {
    if (!socket) return
    if (!isReconnect) {
      reconnect.attempts = reconnect.maxAttempts
    }
    tranistion('stopped')
    socket.close()
  }

  function addEventListener<K extends keyof WebSocketEventMap>(type: K, fn: FnTypeStrict<K>) {
    if (!client) return
    let socket = client
    let copyFn: FnTypeStrict<K> | null = fn

    const wrapper = (e: WebSocketEventMap[K]) => copyFn?.(e, socket)
    const uuid = crypto.randomUUID()
    activeEventListenUUID.add(uuid)
    const buckets = eventBuckets.get(copyFn) ?? {}
    buckets[uuid] = type
    eventBuckets.set(copyFn, buckets)

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

    eventListenCancel.set(uuid, { cancel, bind })

    socket.addEventListener(type, wrapper)
    console.log(eventBuckets);

    return cancel
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



