import EventEmitter from 'events'
import { noop } from 'lodash'
import { debugEvents, debugMethods } from 'simple-debugger'

export default class MockBot extends EventEmitter {
  constructor() {
    super()

    debugEvents(this)
    debugMethods(this, [ 'on', 'once', 'emit' ])

    this.sendMessageProxy = noop
  }

  async sendMessage(...args) {
    return this.sendMessageProxy(...args)
  }

  setSendMessageProxy(proxy) {
    this.sendMessageProxy = proxy
    return this
  }

  delSendMessageProxy() {
    this.sendMessageProxy = noop
  }
}
