# Authy user client

> Access your Authy TOTP secrets! 🔐

## Overview

So you want to migrate from Authy to another 2FA provider?

Or you're [constrained](https://randomoracle.wordpress.com/2017/02/15/extracting-otp-seeds-from-authy/)
to use Authy's proprietary TOTP implementation with a service that don't
support standard 2FA (looking at you SendGrid) but you want a way to use
it with your preferred 2FA provider or password manager?

Don't look any further, this library got you covered! 😎

## Installation

You need [Node.js](https://nodejs.org/) for this program to run.

Install the CLI globally:

```sh
npm install -g authy-user-client
```

Install as a Node.js library:

```sh
npm install authy-user-client
```

## Usage

### Dump all the secrets! 🥳

The primary command that will more likely do everything you need:

```sh
authy-user-client dump
```

1. Retrieve the Authy ID from a country code and phone number.
1. Register a new Authy device for that account using the selected
   method (push, call or SMS).
1. Retrieve all the apps registered for that account and for each of
   them, show a standard TOTP URL that can be imported in your favorite app.

If you want more fine-grained control, you can use the following
individual commands.

### Check a Authy user status

```sh
authy-user-client check-user-status <country-code> <phone-number>
```

This will give you the Authy ID for the given phone number if
registered.

### Start device registration

```sh
authy-user-client registration start <authy-id> (push | call | sms)
```

Start the registration process for the given Authy ID using the given
authentication method, between push to an existing Authy device, call or
SMS to the registered phone number.

This will save the `authy_id` to `authy-user-client-state.json` so that
you don't have to explicitly pass it in all the following commands.

### Complete device registration

```sh
authy-user-client registration complete <pin>
```

End the registration with the given PIN that was sent via the previous
step.

This will save the registration response to
`authy-user-client-state.json` file so that you don't have to explicitly
pass the `authy_id`, `client_id` and `secret_seed` in all the following
commands.

### List devices

```sh
authy-user-client devices list
```

This will show all the devices registered for this Authy account,
including their ID and a number of other details.

### Delete a device

```sh
authy-user-client devices rm <device-id>
```

Delete the given device. You won't be able to delete the device you're
execute this request from.

### Enable multi-device

```sh
authy-user-client multi-device enable
```

Enable the [multi-device feature](https://support.authy.com/hc/en-us/articles/360016317013-Enable-or-Disable-Authy-Multi-Device)
to allow adding more devices.

### Disable multi-device

```sh
authy-user-client multi-device disable
```

Disable the [multi-device feature](https://support.authy.com/hc/en-us/articles/360016317013-Enable-or-Disable-Authy-Multi-Device)
to restrict access to the currently registered devices.

### Sync

```sh
authy-user-client sync
```

Sync the Authy state, effectively retrieving all the registered apps
including their TOTP secret and settings.

## API

If you want to use this package as a Node.js library. 🧑‍💻

```js
const authyUserClient = require('authy-user-client')
```

### Get OTP

```js
const otp = await authy.getOtp(secretSeed)
```

Get a 7 digits Authy OTP code from the given hex secret.

### Get OTPs

```js
const { otp1, otp2, otp3 } = await authy.getOtps(secretSeed)
```

Get the 3 next OTP intervals. Convenience method for a number of API
requests that require we send those 3 OTPs.

### Check a Authy user status

```js
await authy.checkUserStatus({ country_code: '1', phone_number: '1234567890' })
```

```json
{
  "force_ott": false,
  "message": "active",
  "devices_count": 42,
  "authy_id": 111111111,
  "success": true
}
```

### Start device registration

```js
await authy.startRegistration({
   authy_id: 111111111,
   // via: 'push',
   // via: 'call',
   via: 'sms',

   // Not sure why, but works better with this. 🤷
   signature: crypto.randomBytes(32).toString('hex')
})
```

```json
{
  "message": "PIN was sent via text-message. Please allow at least 1 minute for the text to arrive.",
  "request_id": "63c5e5d37e48672bc558405f",
  "approval_pin": 42,
  "provider": null,
  "success": true
}
```

### Complete device registration

```js
await authy.completeRegistration({
   authy_id: 111111111,
   pin: 133769
})
```

```json
{
  "device": {
    "id": 222222222,
    "secret_seed": "b26ef78813a1f8600da7e9b4d5f62011",
    "api_key": "c93266f4d93902b89c998ce74163ea98",
    "reinstall": false
  },
  "authy_id": 111111111
}
```

### List devices

```js
await authy.listDevices({
   authy_id: 111111111,
   device_id: 222222222,
   ...authy.getOtps('b26ef78813a1f8600da7e9b4d5f62011')
})
```

```json
{
  "message": "Devices List",
  "devices": [
    {
      "master_token_id": 333333333,
      "name": "Chrome",
      "registration_city": "Montcuq",
      "registration_country": "France",
      "user_agent": "Mozilla/5.0 (X11; OpenBSD amd64; rv:42.0) Gecko/1337 Firefox/69.0"
    }
  ]
}
```

There's more fields in there, just quoted those for example.

### Delete a device

```js
await authy.deleteDevice({
   authy_id: 111111111,
   delete_device_id: 333333333,
   device_id: 222222222,
   ...authy.getOtps('b26ef78813a1f8600da7e9b4d5f62011')
})
```

```json
{
  "message": "The device was deleted",
  "success": true
}
```

### Enable multi-device

```js
await authy.enableMultiDevice({
   authy_id: 111111111,
   device_id: 222222222,
   ...authy.getOtps('b26ef78813a1f8600da7e9b4d5f62011')
})
```

```json
{
  "message": "Settings changed.",
  "success": true
}
```

### Disable multi-device


```js
await authy.disableMultiDevice({
   authy_id: 111111111,
   device_id: 222222222,
   ...authy.getOtps('b26ef78813a1f8600da7e9b4d5f62011')
})
```

```json
{
  "message": "Settings changed.",
  "success": true
}
```

### Sync


```js
await authy.sync({
   authy_id: 111111111,
   device_id: 222222222,
   ...authy.getOtps('b26ef78813a1f8600da7e9b4d5f62011')
})
```

```json
{
  "message": "App Sync.",
  "apps": [
    {
      "name": "SendGrid",
      "authy_id": 444444444,
      "secret_seed": "8fcc63651386dcb2ac18c0095fa61704",
      "digits": 7
    }
  ],
  "deleted": [],
  "success": true
}
```

There's more fields in there, just quoted those for example.

## Difference with authy-client

[authy-client](https://github.com/ruimarinho/authy-client) is a client
for the official Authy API, for services to provide 2FA to their users
through Authy.

In contrast, **Authy user client** is meant to be used by the users
themselves, to manage their Authy account from the CLI, without having
to install any of the Authy apps, in a way that opens all the data and
makes it easy to use the Authy secrets with any standard TOTP provider
or password manager with TOTP support.

## Alternatives

See also the equivalent [Go version](https://github.com/alexzorin/authy)
if that's more your jam. 🍓

## Debugging

Set `DEBUG=authy-user-client` in your environment to see all the
requests and responses made by this program.
