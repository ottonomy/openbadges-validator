const jws = require('jws');
const test = require('tap').test;
const validator = require('..');
const nock = require('nock');
const generators = require('./test-generators');
const keys = require('./test-keys');

var httpScope = nock('https://example.org');

test('validate, signed', function (t) {
  const assertion = generators['1.0.0-assertion']({
    verify: {
      type: 'signed',
      url: 'https://example.org/public-key'
    }
  });
  const badge = generators['1.0.0-badge']();
  const issuer = generators['1.0.0-issuer']();
  httpScope
    .get('/').reply(200, 'root')
    .get('/public-key').reply(200, keys.public)
    .get('/badge').reply(200, JSON.stringify(badge))
    .get('/issuer').reply(200, JSON.stringify(issuer))
    .get('/assertion-image').reply(200, 'assertion-image', {'content-type': 'image/png'})
    .get('/badge-image').reply(200, 'badge-image', {'content-type': 'image/png'})
    .get('/issuer-image').reply(200, 'issuer-image')
    .get('/evidence').reply(200, 'evidence')
    .get('/criteria').reply(200, 'criteria')
    .get('/revocation-list').reply(200, '{"found":true}')
  const signature = jws.sign({
    header: { alg: 'rs256' },
    payload: assertion,
    privateKey: keys.private
  });
  validator(signature, function (err, data) {
    t.notOk(err, 'no errors');
    t.same(data.signature, signature);
    t.same(data.resources['badge.image'], 'badge-image');
    t.end();
  });
});

test('validate, signed: missing badge criteria', function (t) {
  const assertion = generators['1.0.0-assertion']({
    verify: {
      type: 'signed',
      url: 'https://example.org/public-key'
    }
  });
  const badge = generators['1.0.0-badge']({criteria: null});
  const issuer = generators['1.0.0-issuer']();
  httpScope
    .get('/').reply(200, 'root')
    .get('/public-key').reply(200, keys.public)
    .get('/badge').reply(200, JSON.stringify(badge))
    .get('/issuer').reply(200, JSON.stringify(issuer))
    .get('/assertion-image').reply(200, 'assertion-image', {'content-type': 'image/png'})
    .get('/badge-image').reply(200, 'badge-image', {'content-type': 'image/png'})
    .get('/issuer-image').reply(200, 'issuer-image')
    .get('/evidence').reply(200, 'evidence')
    .get('/criteria').reply(200, 'criteria')
    .get('/revocation-list').reply(200, '{"found":true}')
  const signature = jws.sign({
    header: { alg: 'rs256' },
    payload: assertion,
    privateKey: keys.private
  });
  validator(signature, function (err, data) {
    t.same(err.code, 'structure');
    t.ok(err.extra.badge.criteria, 'badge `criteria` error');
    t.end();
  });
});

test('validate, new hosted', function (t) {
  const assertion = generators['1.0.0-assertion']();
  const badge = generators['1.0.0-badge']();
  const issuer = generators['1.0.0-issuer']();
  httpScope
    .get('/').reply(200, 'root')
    .get('/assertion').reply(200, JSON.stringify(assertion))
    .get('/badge').reply(200, JSON.stringify(badge))
    .get('/issuer').reply(200, JSON.stringify(issuer))
    .get('/assertion-image').reply(200, 'assertion-image', {'content-type': 'image/png'})
    .get('/badge-image').reply(200, 'badge-image', {'content-type': 'image/png'})
    .get('/issuer-image').reply(200, 'issuer-image')
    .get('/evidence').reply(200, 'evidence')
    .get('/criteria').reply(200, 'criteria')
    .get('/revocation-list').reply(200, '{"found":true}')
  validator(assertion, function (err, data) {
    t.notOk(err, 'should have no errors');
    t.end();
  });
});

test('validate, new hosted, invalid', function (t) {
  const assertion = generators['1.0.0-assertion']();
  const wrongAssertion = generators['1.0.0-assertion']({
    'evidence': 'https://example.org/some-other-thing'
  });
  const badge = generators['1.0.0-badge']();
  const issuer = generators['1.0.0-issuer']();
  httpScope
    .get('/').reply(200, 'root')
    .get('/assertion').reply(200, JSON.stringify(wrongAssertion))
    .get('/badge').reply(200, JSON.stringify(badge))
    .get('/issuer').reply(200, JSON.stringify(issuer))
    .get('/assertion-image').reply(200, 'assertion-image', {'content-type': 'image/png'})
    .get('/badge-image').reply(200, 'badge-image', {'content-type': 'image/png'})
    .get('/issuer-image').reply(200, 'issuer-image')
    .get('/evidence').reply(200, 'evidence')
    .get('/criteria').reply(200, 'criteria')
    .get('/revocation-list').reply(200, '{"found":true}')
  validator(assertion, function (err, data) {
    t.same(err.code, 'verify-hosted');
    t.end();
  });
});

test('validate, old style', function (t) {
  httpScope
    .get('/').reply(200, 'root')
    .get('/image').reply(200, 'image', {'content-type': 'image/png'})
    .get('/evidence').reply(200, 'evidence')
    .get('/criteria').reply(200, 'criteria')
  const assertion = generators['0.5.0']();
  validator(assertion, function (err, data) {
    t.notOk(err, 'no errors');
    t.same(data.version, '0.5.0');
    t.same(data.assertion.badge, data.badge);
    t.end();
  });
});

function forEach(obj, fn) {
  Object.keys(obj).forEach(function (key) {
    return fn(key, obj[key]);
  });
}

function pluck(field) {
  return function (obj) {
    return obj[field];
  }
}