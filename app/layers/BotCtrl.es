'use strict'

import { isFunction } from 'lodash'
import { debugEvents, debugMethods } from 'simple-debugger'
import EventEmitter from 'events'
import crypto from 'crypto'
import Bot from 'node-telegram-bot-api'
import FsKV from '../libs/FsKV'

let sha1 = v => crypto
  .createHash('sha1')
  .update(v.toString())
  .digest('hex')

export default class BotCtrl extends EventEmitter {
  constructor(config, logger) {
    super()

    debugEvents(this)
    debugMethods(this, [ 'on', 'once', 'emit' ])

    this.config = config
    this.logger = logger.reg()

    this.bot = null
    this.handlerMap = {
      '/login':  this.loginHandler.bind(this),
      '/logout': this.logoutHandler.bind(this),
      '/help': this.helpHandler.bind(this),
      '/start': this.helpHandler.bind(this)
    }
  }

  attachTaskProvider(provider) {
    provider.on('needSend', this.needSendHandler.bind(this))
    return this
  }

  async needSendHandler(taskId, token, text) {
    try {
      let chat = await this.token2chat.get(token)
      await this.bot.sendMessage(chat, text)
      this.logger.info(`process task - success #${taskId} send [${text}] to ${chat}`)
      this.emit('sendSuccess', taskId, 'ok :)')
    } catch (err) {
      this.logger.error(`process task - problem #${taskId} send [${text}] to ${token}: %s`, err)
      this.emit('sendProblem', taskId, err)
    }
  }

  async init() {
    await this.initStorage()
    await this.initBot()
    return this
  }
  async initStorage() {
    this.token2chat = new FsKV(this.config.token2chatsPath)
    await this.token2chat.init()
  }
  async initBot() {
    this.bot = new Bot(this.config.token, { polling: true })
    this.bot.on('text', async msg => {
      try {
        let chat = msg.chat.id
        let text = msg.text
        let user = msg.from.username

        let handler = this.handlerMap[text]
        let responce = isFunction(handler)
          ? await handler(chat)
          : 'wrong cmd :('

        await this.bot.sendMessage(chat, responce)
        this.logger.info(`process cmd - success [${text}] from ${user}`)
      } catch (err) {
        this.logger.error('process cmd - problem with [%s]: %s', msg, err)
      }
    })
  }

  async loginHandler(chat) {
    let token

    if (!await this.token2chat.hasByValue(chat)) {
      token = sha1(chat)
      await this.token2chat.set(token, chat)
    } else {
      token = await this.token2chat.getByValue(chat)
    }

    return await this.generateBashAlias(token)
  }
  async logoutHandler(chat) {
    if (!await this.token2chat.hasByValue(chat)) {
      return 'login first :('
    } else {
      await this.token2chat.deleteByValue(chat)
      return 'ok :)'
    }
  }
  async helpHandler() {
    return `
      This bot can send you notifications about completing console tasks.
      Actually, this is just an "alert" command for remote server.

      If you want to start use this project:
      1. Register yourself: /login
      2. Add generated alias "talert" in your ~/.bashrc
      3. Update bash: run "source ~/.bashrc" without quotes
      4. Test talert: run "sleep 3; talert" without quotes
      5. Get expected notification about completing your task

      If you want to stop use this project:
      1. Remove your token: /logout
      2. Delete alias added previously from ~/.bashrc
      3. Update bash: source ~/.bashrc`
  }

  async generateBashAlias(token) {
    let code  = `$([ $? == 0 ] && echo ✔ || echo ✖)`
    let user  = `$USER`
    let host  = `$([ $(hostname -f) == localhost ] && echo $(hostname) || echo $(hostname -f))`
    let wlcm  = `$([ $USER == root ] && echo \\# || echo \\$)`
    let promt = `${ user }@${ host }${ wlcm }`
    let cmd   = `$(history|tail -n1|sed -e '\\''s/^\\s*[0-9]\\+\\s*//;s/[|;&]\\+\\s*talert\\s*$//'\\'')`

    return `
      alias talert-debug='curl -f -s ${ this.config.publicAddress } \
        --data-urlencode  "text=${ code } ${ promt } ${ cmd }" \
        --data-urlencode "token=${ token }"'
      alias talert='talert-debug > /dev/null 2>&1'`
  }
}
