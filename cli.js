const fs = require('fs').promises
const crypto = require('crypto')
const { docopt } = require('docopt')
const prompts = require('prompts')
const uri = require('uri-tag').default
const authy = require('.')
const pkg = require('./package')

const doc = `
Usage:
  authy-user-client dump
  authy-user-client check-user-status <country-code> <phone-number>
  authy-user-client create-user <email> <country-code> <phone-number>
  authy-user-client registration start <authy-id> (push | call | sms)
  authy-user-client registration complete <pin>
  authy-user-client devices list
  authy-user-client devices rm <device-id>
  authy-user-client multi-device enable
  authy-user-client multi-device disable
  authy-user-client sync
`

async function prompt (params) {
  const res = await prompts({ ...params, name: 'value' })

  if (!res.value) {
    process.exit()
  }

  return res.value
}

async function loadState () {
  return JSON.parse(await fs.readFile('authy-user-client-state.json', 'utf8'))
}

async function saveState (state) {
  await fs.writeFile('authy-user-client-state.json', JSON.stringify(state, null, 2) + '\n')
  console.log('State written to `authy-user-client-state.json`')
}

async function checkUserStatus (countryCode, phoneNumber) {
  const res = await authy.checkUserStatus({
    country_code: countryCode,
    cellphone: phoneNumber
  })

  console.log(JSON.stringify(res, null, 2))
}

async function createUser (email, countryCode, phoneNumber) {
  const res = await authy.createUser({
    email,
    country_code: countryCode,
    cellphone: phoneNumber
  })

  console.log(JSON.stringify(res, null, 2))
}

async function startRegistration (authyId, via) {
  const res = await authy.startRegistration({
    authy_id: authyId,
    via,
    signature: crypto.randomBytes(32).toString('hex')
  })

  saveState({ authy_id: authyId })

  console.log(JSON.stringify(res, null, 2))
}

async function completeRegistration (pin) {
  const state = await loadState()

  const res = await authy.completeRegistration({
    authy_id: state.authy_id,
    pin
  })

  saveState(res)

  console.log(JSON.stringify(res, null, 2))
}

async function listDevices () {
  const state = await loadState()

  const res = await authy.listDevices({
    authy_id: state.authy_id,
    device_id: state.device.id,
    ...authy.getOtps(state.device.secret_seed)
  })

  for (const device of res.devices) {
    console.log(`${device.master_token_id}: ${device.name} (${device.registration_city}, ${device.registration_country}) "${device.user_agent}"`)
  }
}

async function deleteDevice (deviceId) {
  const state = await loadState()

  const res = await authy.deleteDevice({
    authy_id: state.authy_id,
    delete_device_id: deviceId,
    device_id: state.device.id,
    ...authy.getOtps(state.device.secret_seed)
  })

  console.log(res.message)
}

async function enableMultiDevice () {
  const state = await loadState()

  const res = await authy.enableMultiDevice({
    authy_id: state.authy_id,
    device_id: state.device.id,
    ...authy.getOtps(state.device.secret_seed)
  })

  console.log(res.message)
}

async function disableMultiDevice () {
  const state = await loadState()

  const res = await authy.disableMultiDevice({
    authy_id: state.authy_id,
    device_id: state.device.id,
    ...authy.getOtps(state.device.secret_seed)
  })

  console.log(res.message)
}

function printApps (apps) {
  for (const app of apps) {
    const url = new URL(uri`otpauth://totp/${app.name}`)

    url.search = new URLSearchParams(Object.entries({
      // Authy uses hex, everything else uses Base32.
      secret: authy.hexToBase32(app.secret_seed),
      digits: app.digits,
      period: 10
    }))

    console.log(`${app.name}: ${url}`)
  }
}

async function sync () {
  const state = await loadState()

  const res = await authy.sync({
    authy_id: state.authy_id,
    device_id: state.device.id,
    ...authy.getOtps(state.device.secret_seed)
  })

  printApps(res.apps)
}

async function dump () {
  const countryCode = await prompt({ type: 'number', message: 'Country code:', initial: 1, min: 1 })
  const phoneNumber = await prompt({ type: 'number', name: 'phoneNumber', message: 'Phone number:', validate: value => value !== '' })

  const status = await authy.checkUserStatus({ country_code: countryCode, cellphone: phoneNumber })
  let authyId = status.authy_id

  if (!authyId) {
    const email = await prompt({ type: 'text', message: 'Email:' })
    const registration = await authy.createUser({ email, country_code: countryCode, cellphone: phoneNumber })
    authyId = registration.authy_id
  }

  saveState({ authy_id: authyId })

  const via = await prompt({
    type: 'select',
    message: 'Authentication method:',
    choices: [
      { title: 'Push', value: 'push' },
      { title: 'Call', value: 'call' },
      { title: 'SMS', value: 'sms' }
    ]
  })

  await authy.startRegistration({
    authy_id: authyId,
    via,
    signature: crypto.randomBytes(32).toString('hex')
  })

  const pin = await prompt({ type: 'number', message: 'PIN:', min: 1, validate: value => value !== '' })
  const registrationResponse = await authy.completeRegistration({ authy_id: authyId, pin })

  saveState(registrationResponse)

  const deviceId = registrationResponse.device.id
  const secretSeed = registrationResponse.device.secret_seed

  const syncResponse = await authy.sync({
    authy_id: authyId,
    device_id: deviceId,
    ...authy.getOtps(secretSeed)
  })

  printApps(syncResponse.apps)
}

module.exports = async function cli (argv) {
  const opts = docopt(doc, { argv, version: pkg.version })

  switch (true) {
    case opts.dump:
      return dump()
    case opts['check-user-status']:
      return checkUserStatus(opts['<country-code>'], opts['<phone-number>'])
    case opts['create-user']:
      return createUser(opts['<email>'], opts['<country-code>'], opts['<phone-number>'])
    case opts.registration && opts.start:
      return startRegistration(opts['<authy-id>'], ['push', 'call', 'sms'].find(via => opts[via]))
    case opts.registration && opts.complete:
      return completeRegistration(opts['<pin>'])
    case opts.devices && opts.list:
      return listDevices()
    case opts.devices && opts.rm:
      return deleteDevice(opts['<device-id>'])
    case opts['multi-device'] && opts.enable:
      return enableMultiDevice()
    case opts['multi-device'] && opts.disable:
      return disableMultiDevice()
    case opts.sync:
      return sync()
  }
}
