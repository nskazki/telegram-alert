'use strict'

import BotCtrl  from './layers/BotCtrl'
import HttpCtrl from './layers/HttpCtrl'

import P from 'bluebird'

export default class Server {
  constructor(config, logger) {
    this.config = config
    this.logger = logger

    this.botCtrl = null
    this.httpCtrl = null
  }

  init() {
    this.botCtrl  = new BotCtrl(this.config.botCtrl, this.logger)
    this.httpCtrl = new HttpCtrl(this.config.httpCtrl, this.logger)

    this.botCtrl.attachTaskProvider(this.httpCtrl)
    this.httpCtrl.attachTaskHandler(this.botCtrl)

    return P.join(
      this.botCtrl.init(),
      this.httpCtrl.init())
  }
}
