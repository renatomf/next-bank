#!/bin/sh
# API-14 (v1.1.0 plan, task 8): the published API counts login attempts per
# client, and finds the client only while TRUST_PROXY matches the hops in
# front of it (F-29). Asks it three times which address it gives this runner:
# plain, with a forged X-Forwarded-For, plain again. IPv4, the version the
# hops were measured in. Usage: check-client-ip.sh <api-url>
set -eu
api_url="$1"
forged='203.0.113.66' # A documentation address (RFC 5737), never a client.

client_ip() {
  curl -4 -fsS --max-time 30 "$@" "$api_url/health/client-ip" |
    sed -n 's/.*"ip":"\([^"]*\)".*/\1/p'
}

first=$(client_ip)
spoofed=$(client_ip -H "x-forwarded-for: $forged")
again=$(client_ip)

fail() {
  echo "API-14: $1 See docs/operations.md, section 6." >&2
  exit 1
}

if [ "$spoofed" = "$forged" ]; then
  fail "the forged address won ($forged): TRUST_PROXY trusts more hops than there are; lower it."
fi
if [ "$first" != "$spoofed" ] || [ "$first" != "$again" ]; then
  fail "the addresses differ ($first, $spoofed, $again): a proxy is taken for the client; raise TRUST_PROXY."
fi
case "$first" in
  10.* | 127.* | 192.168.* | 172.1[6-9].* | 172.2[0-9].* | 172.3[01].* | \
    100.6[4-9].* | 100.[7-9][0-9].* | 100.1[01][0-9].* | 100.12[0-7].* | '')
    fail "the address is internal ($first): a proxy is taken for the client; raise TRUST_PROXY."
    ;;
esac
echo "API-14: the API sees this runner as $first, also with a forged X-Forwarded-For."
