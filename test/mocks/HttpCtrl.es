import EventEmitter from 'events'
import { debugEvents, debugMethods } from 'simple-debugger'

export default class MockBot extends EventEmitter {
  constructor() {
    super()

    debugEvents(this)
    debugMethods(this, [ 'on', 'once', 'emit' ])
  }
}
