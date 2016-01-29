'use strict'

import { debugEvents, debugMethods } from 'simple-debugger'
import { merge } from 'lodash'
import Express from 'express'
import EventEmitter from 'events'
import P from 'bluebird'
import bodyParser from 'body-parser'

export default class HttpCtrl extends EventEmitter {
  constructor(config, logger) {
    super()

    debugEvents(this)
    debugMethods(this, [ 'on', 'once', 'emit' ])

    this.config = config
    this.logger = logger.reg()

    this.taskQueue = []
    this.express = null
    this.httpServer = null
  }

  attachTaskHandler(handler) {
    handler
      .on('sendSuccess', this.sendSuccessHandler.bind(this))
      .on('sendProblem', this.sendProblemHandler.bind(this))
  }

  sendSuccessHandler(id, res) {
    this.taskQueue[id].json(res)
    delete this.taskQueue[id]
  }

  sendProblemHandler(id, err) {
    this.taskQueue[id].json(err.toString())
    delete this.taskQueue[id]
  }

  init() {
    return P.bind(this)
      .then(this.initExpress)
      .then(this.initHttpServer)
  }

  initExpress() {
    this.express = Express()
    this.express
      .use(bodyParser.urlencoded({ extended: true }))
      .use(bodyParser.json())
      .route('/')
      .all((req, res) => {
        let id = this.taskQueue.push(res) - 1
        let opt = merge({}, req.query, req.body)
        this.emit('needSend', id, opt.token, opt.text)
      })
  }

  initHttpServer() {
    return new P((resolve, reject) => {
      this.httpServer = this.express
        .listen(this.config.port)
        .once('listening', () => {
          this.logger.info(`http server start - success on port ${this.config.port}`)
          resolve()
        })
        .once('error', (err) => {
          err.message = `http server start - problem on port ${this.config.port}: ${err.message}`
          reject(err)
        })
    })
  }
}
