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

export function useWebsocket(url: string, options?: WebSocketOptions) {
  let websocketClient: WebSocket | null = null
  let client: WebSocket | null = null
  let connectTimeout = 10000 //连接超时时间

  const reconnect: ReconnectType = {
    attempts: 0,
    timer: null,
    interval: 5000,
    maxAttempts: 3
  }

  let reconnectAttempts: number = 0 //重连已连接次数
  let reconnectTimeoutTimer: ReturnType<typeof setTimeout> | null = null //重连定时器
  let reconnectInterval: number = options?.reconnectInterval ?? 5000 //重连时间间隔
  let maxReconnectAttempts: number = options?.maxReconnectAttempts ?? 5 //最大连接次数




  const { CONNECTING, OPEN, CLOSED, CLOSING } = WebSocket


  function clearReconnectTimer() {
    if (reconnect['timer'] !== null) {
      clearTimeout(reconnect['timer'])
      reconnect['timer'] = null
    }
  }


  let connectState: State = 'idle'

  function tranistion(socket: WebSocket | null, nextState: TranistionsState): boolean {
    const tranistionsMap: TranistionsStateMap = {
      'connecting': ['idle'],
      'connected': ['connecting', 'reconnecting'],
      'reconnecting': ['stopped'],
      'stopped': ['connecting', 'reconnecting', 'connected']
    }

    const allowed = tranistionsMap[nextState]
    if (!allowed.includes(connectState)) return false
    connectState = nextState


    switch (nextState) {
      case 'connecting':
        clearReconnectTimer()
        break
      case 'connected':
        reconnect['maxAttempts'] = options?.maxReconnectAttempts ?? 3


        break
      case 'reconnecting':
        clearReconnectTimer()
        
        socket?.close()
        break
      case 'stopped':
        break
      default:
        break
    }
    return true
  }

  function connect(connectType: 'connect' | 'reconnect' = 'connect') {
    if (!tranistion(client, connectType === 'connect' ? 'connecting' : 'reconnecting')) return
    const socket = new WebSocket(url)
    _clientEvent(socket)
    client = socket
  }


  function _clientEvent(socket: WebSocket) {
    socket.onopen = () => {
      if (websocketClient !== socket) return
      tranistion(socket, 'connected')
      clearConnectTimeoutTimer()
      executiveSendQueue()
      heartbeat(socket)
    }
    socket.onmessage = () => {

    }
    socket.onclose = () => {

    }
    socket.onerror = () => {
      
    }
  }


  let needReconnect: boolean = true,

    pingInterval: number = options?.pingInterval ?? 30000, //ping时间间隔
    pingOvertime: number = 5000,
    timeoutEvent: ReturnType<typeof setTimeout> | null = null,
    intervalEvent: ReturnType<typeof setInterval> | null = null
  let connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  const sendQueue: any[] = []
  const eventBuckets = new WeakMap<ListenerRef, Record<string, keyof WebSocketEventMap>>()
  const eventListenCancel = new Map<string, ListenerRecord>()
  const activeEventListenUUID = new Set<string>()



  function clearConnectTimeoutTimer() {
    if (connectTimeoutTimer !== null) {
      clearTimeout(connectTimeoutTimer)
      connectTimeoutTimer = null
    }
  }


  function clearSendQueue() {
    sendQueue.length = 0
  }

  function sendMessage(data: BufferSource | Blob | string) {
    if (!websocketClient) return
    const socket = websocketClient
    if (socket.readyState !== 1) {
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

  function _connectTimeout(socket: WebSocket) {
    clearConnectTimeoutTimer()
    connectTimeoutTimer = setTimeout(() => {
      if (socket.readyState !== CONNECTING) {
        socket.close()
      }
      connectTimeoutTimer = null
    }, connectTimeout)
  }

  function websocketConnect() {
    if (websocketClient) return
    if (reconnectTimeoutTimer !== null) {
      clearTimeout(reconnectTimeoutTimer)
      reconnectTimeoutTimer = null
    }
    needReconnect = true
    const socket = new WebSocket(url)

    websocketClient = socket
    _connectTimeout(websocketClient)

    // 在 open 事件触发前恢复监听，沿用原来的 UUID 和取消函数。
    for (const listener of eventListenCancel.values()) {
      listener.bind(socket)
    }

    websocketClient.onopen = () => {
      if (websocketClient !== socket) return
      clearConnectTimeoutTimer()
      console.log("连接了");
      reconnectAttempts = 0
      executiveSendQueue()

      heartbeat(socket)
    }

    websocketClient.onmessage = () => {
      if (websocketClient !== socket) return
      heartbeat(socket)
    }

    websocketClient.onclose = () => {
      if (websocketClient !== socket) return
      clearConnectTimeoutTimer()
      activeEventListenUUID.clear()
      clearHeartbeat()
      websocketClient = null

      if (!needReconnect) return

      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log("超出重试次数");
        return

      }

      const delay = Math.min(
        reconnectInterval * 2 ** reconnectAttempts,
        30_000,
      )
      console.log(`准备第${reconnectAttempts + 1}次重连`);

      reconnectAttempts++
      reconnectTimer = setTimeout(() => {
        websocketConnect()
      }, delay)
    }

    websocketClient.onerror = () => {

    }
  }



  function heartbeat(socket: WebSocket) {
    if (!websocketClient) return
    clearHeartbeat()
    intervalEvent = setInterval(() => {
      socket.send(JSON.stringify({ type: 'heartbeat' }))
      timeoutEvent = setTimeout(() => {
        socket.close()
      }, pingOvertime)
    }, pingInterval)
  }

  function clearHeartbeat() {
    if (intervalEvent !== null) {
      clearInterval(intervalEvent)
      intervalEvent = null
    }
    if (timeoutEvent !== null) {
      clearTimeout(timeoutEvent)
      timeoutEvent = null
    }
  }

  function websocketClose(noReconnect: boolean = true) {
    needReconnect = !noReconnect
    if (!needReconnect) {
      clearEventListener()
    }
    clearConnectTimeoutTimer()
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    clearHeartbeat()
    websocketClient?.close()
  }



  function addEventListener<K extends keyof WebSocketEventMap>(type: K, fn: FnTypeStrict<K>) {
    if (!websocketClient) return
    let socket = websocketClient
    let copyFn: FnTypeStrict<K> | null = fn
    console.log("gugugaga");

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




  function clearEventListener() {
    for (const listener of eventListenCancel.values()) {
      listener.cancel()
    }
  }

  onScopeDispose(() => {

  })

  return {
    websocketConnect, websocketClose, addEventListener, sendMessage
  }
}





//需要修复
