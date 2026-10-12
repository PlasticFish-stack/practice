type WebSocketOptions = {
  reconnectInterval: number,
  maxReconnectAttempts: number,
  pingInterval: number
}

type FnType = (event: Event | CloseEvent | MessageEvent<any>, socket?: WebSocket) => any

let websocketClient: WebSocket | null = null,
  reconnectInterval: number = 5000, //重连时间间隔
  maxReconnectAttempts: number = 5, //最大连接次数
  needReconnect: boolean = true,
  reconnectAttempts: number = 0, //重连已连接次数
  reconnectTimer: ReturnType<typeof setTimeout> | null = null,
  pingInterval: number = 30000, //ping时间间隔
  pingOvertime: number = 5000,
  timeoutEvent: ReturnType<typeof setTimeout> | null = null,
  intervalEvent: ReturnType<typeof setInterval> | null = null

const eventBuckets = new Map<keyof WebSocketEventMap, Set<FnType>>()
const eventListenCancel: Set<() => void> = new Set()

function websocketConnect(url: string, options?: WebSocketOptions) {
  if (websocketClient) return
  if (options) {
    reconnectInterval = options.reconnectInterval
    maxReconnectAttempts = options.maxReconnectAttempts
    pingInterval = options.pingInterval
  }
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  const socket = new WebSocket(url)
  websocketClient = socket
  websocketClient.onopen = () => {
    if (websocketClient !== socket) return
    eventBuckets?.forEach((buckets, key) => {
      buckets.forEach((fn) => {
        addEventListener(key, fn)
      })
    })
    reconnectAttempts = 0
    heartbeat(socket)
  }
  websocketClient.onmessage = () => {
    if (websocketClient !== socket) return
    heartbeat(socket)
  }
  websocketClient.onclose = () => {
    if (websocketClient !== socket) return
    clearHeartbeat()
    websocketClient = null
    if (!needReconnect) return
    if (reconnectAttempts >= maxReconnectAttempts) return

    const delay = Math.min(
      reconnectInterval * 2 ** reconnectAttempts,
      30_000,
    )
    reconnectAttempts++
    reconnectTimer = setTimeout(() => {
      websocketConnect(url, options)
    }, delay)
  }
  return
}


function heartbeat(socket: WebSocket) {
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
  if (!websocketClient) return
  needReconnect = !noReconnect
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  clearHeartbeat()
  clearEventListener()
  websocketClient.close()
}

function addEventListener(type: keyof WebSocketEventMap, fn: FnType) {
  let bucket = eventBuckets.get(type)
  if (!bucket) {
    bucket = new Set<FnType>()
    eventBuckets.set(type, bucket)
  }
  bucket.add(fn)
  return () => {
    const currentBucket = eventBuckets.get(type)
    currentBucket?.delete(fn)
    if (currentBucket?.size === 0) {
      eventBuckets.delete(type)
    }
  }
  // if (!websocketClient) return
  // const socket = websocketClient
  // const wrapper: EventListener = (e) => fn(e, socket)
  // const cancel = () => {
  //   socket.removeEventListener(type, wrapper)
  // }
  // if (eventBuckets.has(type)) {
  //   const buckets = eventBuckets.get(type)
  //   eventBuckets.set(type, [...(buckets ?? []), fn])
  // } else {
  //   eventBuckets.set(type, [fn])
  // }
  // socket.addEventListener(type, wrapper)
  // eventListenCancel.add(cancel)
  // return cancel
}

function 

function clearEventListener() {
  eventListenCancel.forEach((e) => {
    e()
  })
}

//需要修复