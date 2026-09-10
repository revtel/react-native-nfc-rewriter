#!/usr/bin/env ruby

require 'base64'
require 'json'
require 'openssl'

key_id, issuer_id, key_path = ARGV
abort 'usage: app_store_connect_token.rb KEY_ID ISSUER_ID KEY_PATH' unless key_path

def base64url(value)
  Base64.urlsafe_encode64(value, padding: false)
end

issued_at = Time.now.to_i
header = base64url(JSON.generate(alg: 'ES256', kid: key_id, typ: 'JWT'))
payload = base64url(JSON.generate(
  iss: issuer_id,
  iat: issued_at,
  exp: issued_at + 1_200,
  aud: 'appstoreconnect-v1',
))
unsigned_token = "#{header}.#{payload}"

private_key = OpenSSL::PKey.read(File.read(key_path))
der_signature = private_key.sign(OpenSSL::Digest::SHA256.new, unsigned_token)
r, s = OpenSSL::ASN1.decode(der_signature).value.map(&:value)
raw_signature = [r, s].map { |part| part.to_s(2).rjust(32, "\0") }.join

puts "#{unsigned_token}.#{base64url(raw_signature)}"
