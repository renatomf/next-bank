#!/usr/bin/env sh
# Tests check-client-ip.sh (API-14, v1.1.0 plan, task 8) with a fake curl on
# the PATH: it answers the script's three calls (plain, forged, plain) with the
# addresses of each case, so no API is needed. Run from the repository root.
set -u

fake=$(mktemp -d)
trap 'rm -rf "$fake"' EXIT
cat > "$fake/curl" <<'EOF'
#!/usr/bin/env sh
# Answers the Nth call with the Nth address of $FAKE_IPS.
count=$(cat "$FAKE_DIR/count" 2>/dev/null || echo 0)
count=$((count + 1))
echo "$count" > "$FAKE_DIR/count"
ip=$(echo "$FAKE_IPS" | cut -d' ' -f"$count")
printf '{"ip":"%s"}' "$ip"
EOF
chmod +x "$fake/curl"

failures=0
expect() { # name, three addresses, wanted exit code, word the message names
  rm -f "$fake/count"
  output=$(FAKE_DIR="$fake" FAKE_IPS="$2" PATH="$fake:$PATH" \
    sh infra/scripts/check-client-ip.sh https://api.example 2>&1)
  got=$?
  if [ "$got" -ne "$3" ]; then
    echo "FAIL $1: exit $got, wanted $3"
    failures=$((failures + 1))
  elif ! printf '%s' "$output" | grep -q "$4"; then
    echo "FAIL $1: the message does not say \"$4\": $output"
    failures=$((failures + 1))
  else
    echo "ok   $1"
  fi
}

expect 'the same public address three times' '198.51.100.7 198.51.100.7 198.51.100.7' 0 '198.51.100.7'
expect 'a different address each call' '104.16.1.1 172.70.2.2 104.16.3.3' 1 'differ'
expect 'the forged address wins' '198.51.100.7 203.0.113.66 198.51.100.7' 1 'forged'
expect 'an internal proxy address' '10.0.0.5 10.0.0.5 10.0.0.5' 1 'internal'
expect 'a carrier-grade NAT address' '100.64.0.9 100.64.0.9 100.64.0.9' 1 'internal'
expect 'a 172.16-31 address' '172.20.0.3 172.20.0.3 172.20.0.3' 1 'internal'
expect 'a public 172 address' '172.70.0.3 172.70.0.3 172.70.0.3' 0 '172.70.0.3'

[ "$failures" -eq 0 ]
