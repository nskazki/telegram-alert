import { resolve } from 'path'
import { includes, isEqual, merge } from 'lodash'
import proxyquire from 'proxyquire'
import crypto from 'crypto'
import Logger from 'bellman'
import randPath from './libs/rand-path'

import MockLogger from './mocks/Logger'
import MockBot from './mocks/node-telegram-bot-api'
import MockHttpCtrl from './mocks/HttpCtrl'

let genBotConf = async () => {
  return {
    token: 'YOUR_TELEGRAM_BOT_TOKEN',
    publicAddress: 'YOUR_WHITE_IP_ADDRESS:8080',
    token2chatsPath: await randPath(
      resolve(process.cwd(), 'storages/'),
      'test-:rand-token2chats.json')
  }
}

let genObjects = async () => {
  let httpCtrl = new MockHttpCtrl()

  let botConf = await genBotConf()
  let botCtrl = await new BotCtrl(botConf, logger)
    .attachTaskProvider(httpCtrl)
    .init()

  let tlgrBot = botCtrl.bot

  return { httpCtrl, botCtrl, botConf, tlgrBot }
}

let sha1 = v => crypto
  .createHash('sha1')
  .update(v.toString())
  .digest('hex')

let BotCtrl = proxyquire('../app/layers/BotCtrl',
  { 'node-telegram-bot-api': MockBot })

let logger = /true/i.test(process.env.LOGGER)
  ? new Logger({ levelMin: 'error' })
  : new MockLogger()

let baseMsg = {
  chat: { id: 1234 },
  from: { username: 'nskazki' }
}

let loginMsg  = merge({ text: '/login'  }, baseMsg)
let logoutMsg = merge({ text: '/logout' }, baseMsg)

let needSend = {
  token: sha1(baseMsg.chat.id),
  text: 'hi',
  taskId: 0
}

describe('BotCtrl', () => {
  describe('#loginHandler', () => {
    it('ok', async done => {
      try {
        let { tlgrBot, botConf } = await genObjects()

        tlgrBot.emit('text', loginMsg)
        tlgrBot.setSendMessageProxy((chatId, responce) => {
          let checkChatId = isEqual(chatId, baseMsg.chat.id)
            ? null
            : new Error(`problem, wrong chatId: ${chatId}`)

          let checkResponce = (
            includes(responce, botConf.publicAddress) &&
            includes(responce, sha1(baseMsg.chat.id)))
            ? null
            : new Error(`problem: responce not include publicAddress or token: ${responce}`)

          done(checkChatId || checkResponce)
        })
      } catch (err) {
        done(err)
      }
    })
  })

  describe('#logoutHandler', () => {
    it('ok', async done => {
      try {
        let { tlgrBot } = await genObjects()

        tlgrBot.emit('text', loginMsg)
        tlgrBot.setSendMessageProxy(() => {

          tlgrBot.emit('text', logoutMsg)
          tlgrBot.setSendMessageProxy((chatId, responce) => {
            let checkChatId = isEqual(chatId, baseMsg.chat.id)
              ? null
              : new Error(`problme, wrong chatId: ${chatId}`)

            let checkResponce = isEqual(responce, 'ok :)')
              ? null
              : new Error(`problem, wrong responce: ${responce}`)

            done(checkChatId || checkResponce)
          })

        })
      }
      catch (err) {
        done(err)
      }
    })

    it('error', async done => {
      try {
        let { tlgrBot } = await genObjects()

        tlgrBot.emit('text', logoutMsg)
        tlgrBot.setSendMessageProxy((chatId, responce) => {
          let checkChatId = isEqual(chatId, baseMsg.chat.id)
            ? null
            : new Error(`problme, wrong chatId: ${chatId}`)

          let checkResponce = isEqual(responce, 'login first :(')
            ? null
            : new Error(`problem, wrong responce: ${responce}`)

          done(checkChatId || checkResponce)
        })
      }
      catch (err) {
        done(err)
      }
    })
  })

  describe('~needSend', () => {
    it('ok (check sending)', async done => {
      try {
        let { httpCtrl, tlgrBot } = await genObjects()

        tlgrBot.emit('text', loginMsg)
        tlgrBot.setSendMessageProxy(() => {
          httpCtrl.emit('needSend', needSend.taskId, needSend.token, needSend.text)

          tlgrBot.setSendMessageProxy((chatId, sendedText) => {
            let checkChatId = isEqual(chatId, baseMsg.chat.id)
              ? null
              : new Error(`problem, wrong chatId: ${chatId}`)

            let checkSended = isEqual(sendedText, needSend.text)
              ? null
              : new Error(`problem, sendedText: ${sendedText}`)

            done(checkChatId || checkSended)
          })
        })
      } catch (err) {
        done(err)
      }
    })

    it('ok (check confirmation)', async done => {
      try {
        let { httpCtrl, tlgrBot, botCtrl } = await genObjects()

        tlgrBot.emit('text', loginMsg)
        tlgrBot.setSendMessageProxy(() => {

          tlgrBot.delSendMessageProxy()
          httpCtrl.emit('needSend', needSend.taskId, needSend.token, needSend.text)
          botCtrl.once('sendSuccess', taskId => {
            let checkSendTaskId = isEqual(taskId, needSend.taskId)
              ? null
              : new Error(`problem, wrong needSend.taskId: ${taskId}`)
            done(checkSendTaskId)
          })

        })
      } catch (err) {
        done(err)
      }
    })

    it('error', async done => {
      try {
        let { httpCtrl, botCtrl } = await genObjects()

        httpCtrl.emit('needSend', needSend.taskId, needSend.token, needSend.text)
        botCtrl.once('sendProblem', taskId => {
          let checkSendTaskId = isEqual(taskId, needSend.taskId)
            ? null
            : new Error(`problem, wrong needSend.taskId: ${taskId}`)
          done(checkSendTaskId)
        })
      } catch (err) {
        done(err)
      }
    })
  })
})
