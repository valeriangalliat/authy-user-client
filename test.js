const test = require('ava')
const authyUserClient = require('.')

test('hexToBase32', t => {
  t.is(authyUserClient.hexToBase32('c2694a89c83f56a1'), 'YJUUVCOIH5LKC')
})

test('base32ToHex', t => {
  t.is(authyUserClient.base32ToHex('YJUUVCOIH5LKC'), 'c2694a89c83f56a1')
})

test('getOtp', t => {
  Date.now = () => 1465324707000
  t.is(authyUserClient.getOtp('c2694a89c83f56a1'), '1861345')
})

test('getOtps', t => {
  Date.now = () => 1465324707000
  t.deepEqual(authyUserClient.getOtps('c2694a89c83f56a1'), { otp1: '1861345', otp2: '9818402', otp3: '2079099' })
})
