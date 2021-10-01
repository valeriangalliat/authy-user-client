const debug = require('debug')('authy-user-client')
const fetch = require('node-fetch')
const base32 = require('rfc-3548-b32')
const totpGenerator = require('totp-generator')

const baseUrl = 'https://api.authy.com/json'

// Public API key from Authy Chrome extension.
const authyPublicApiKey = '37b312a3d682b823c439522e1fd31c82'

function hexToBase32 (secret) {
  return base32.encode(Buffer.from(secret, 'hex')).replace(/=+$/, '')
}

function base32ToHex (secret) {
  return base32.decode(secret).toString('hex')
}

function getOtp (secret) {
  // `totpGenerator` wants Base32, Authy uses hex.
  secret = base32.encode(Buffer.from(secret, 'hex'))
  return totpGenerator(secret, { digits: 7, period: 10 })
}

function getOtps (secret) {
  // `totpGenerator` wants Base32, Authy uses hex.
  secret = base32.encode(Buffer.from(secret, 'hex'))

  const now = Date.now()

  return {
    otp1: totpGenerator(secret, { digits: 7, period: 10, timestamp: now }),
    otp2: totpGenerator(secret, { digits: 7, period: 10, timestamp: now + 10_000 }),
    otp3: totpGenerator(secret, { digits: 7, period: 10, timestamp: now + 20_000 })
  }
}

function api (opts) {
  return function (params) {
    params = Object.assign({ api_key: authyPublicApiKey }, params)

    const path = typeof opts.url === 'string' ? opts.url : opts.url(params)
    const url = new URL(`${baseUrl}${path}`)

    if (opts.search) {
      url.search = new URLSearchParams(opts.search.filter(key => key in params).map(key => [key, params[key]]))
    }

    const options = {}

    if (opts.body) {
      options.method = 'POST'
      options.body = new URLSearchParams(opts.body.filter(key => key in params).map(key => [key, params[key]]))
    }

    debug(`${options.method || 'GET'} ${url}`)

    if (opts.body) {
      debug('request %s', options.body)
    }

    return fetch(url, options)
      .then(async res => {
        const text = await res.text()
        let body

        try {
          body = JSON.parse(text)
        } catch (err) {
          debug('response %s %s', res.status, text)
          throw new Error(`${url} responded with ${res.status} and invalid JSON body`)
        }

        debug('response %s %O', res.status, body)

        if (!res.ok) {
          throw new Error(`${url} responded with ${res.status}`)
        }

        return body
      })
  }
}

const checkUserStatus = api({
  url: p => `/users/${p.country_code}-${p.cellphone}/status`,
  search: ['api_key']
})

const createUser = api({
  url: '/users/new',
  body: ['api_key', 'locale', 'email', 'cellphone', 'country_code']
})

const startRegistration = api({
  url: p => `/users/${p.authy_id}/devices/registration/start`,
  body: ['api_key', 'locale', 'via', 'signature', 'device_app']
})

const completeRegistration = api({
  url: p => `/users/${p.authy_id}/devices/registration/complete`,
  body: ['api_key', 'locale', 'pin']
})

const listDevices = api({
  url: p => `/users/${p.authy_id}/devices`,
  search: ['api_key', 'locale', 'otp1', 'otp2', 'otp3', 'device_id']
})

const deleteDevice = api({
  url: p => `/users/${p.authy_id}/devices/${p.delete_device_id}/delete`,
  body: ['api_key', 'locale', 'otp1', 'otp2', 'otp3', 'device_id']
})

const enableMultiDevice = api({
  url: p => `/users/${p.authy_id}/devices/enable`,
  body: ['api_key', 'locale', 'otp1', 'otp2', 'otp3', 'device_id']
})

const disableMultiDevice = api({
  url: p => `/users/${p.authy_id}/devices/disable`,
  body: ['api_key', 'locale', 'otp1', 'otp2', 'otp3', 'device_id']
})

const sync = api({
  url: p => `/users/${p.authy_id}/devices/${p.device_id}/apps/sync`,
  body: ['api_key', 'locale', 'otp1', 'otp2', 'otp3', 'device_id']
})

module.exports = {
  hexToBase32,
  base32ToHex,
  getOtp,
  getOtps,
  checkUserStatus,
  createUser,
  listDevices,
  deleteDevice,
  enableMultiDevice,
  disableMultiDevice,
  startRegistration,
  completeRegistration,
  sync
}
