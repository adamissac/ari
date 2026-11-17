#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PY="${RL_PYTHON:-$ROOT/.venv/bin/python}"
PIN="8113a37f4ff9360a9efed2e9f499c4b2ae36e97bfb78372436f97da106fc05f1"
CKPT="rl-defense/results/live-retrain-v6/candidate_online.pt"
DEVICE="${RL_DEVICE:-auto}"
LOG_DIR="${RL_SMOKE_LOG_DIR:-$ROOT/rl-defense/runs/live-smoke/checks}"
SERVING="backend/tests/live_defense_e2e/test_rl_shadow_serving.py"
mkdir -p "$LOG_DIR"
PASSED=0
FAILED=0

report() {
  if [ "$1" -eq 0 ]; then
    PASSED=$((PASSED + 1))
    echo "PASS: $2"
  else
    FAILED=$((FAILED + 1))
    echo "FAIL: $2 (log: $3)"
  fi
}

run_check() {
  local name="$1" label="$2"
  shift 2
  "$@" >"$LOG_DIR/$name.log" 2>&1
  report $? "$label" "$LOG_DIR/$name.log"
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

check_pin() {
  local actual
  actual="$(sha256_of "$CKPT")"
  echo "checkpoint $CKPT sha256 $actual pin $PIN"
  [ "$actual" = "$PIN" ]
}

check_live_loop() {
  make -s rl-live-smoke RL_PYTHON="$PY" RL_DEVICE="$DEVICE" || return 1
  "$PY" - <<'PY'
import json, pathlib, sys
s = json.loads(pathlib.Path("rl-defense/runs/live-smoke/summary.json").read_text())
print({k: s[k] for k in ("episodes", "steps", "transitions_written", "device", "checkpoint_sha256")})
sys.exit(0 if s["passed"] and s["transitions_written"] >= 1 and s["episodes"] == 1 else 1)
PY
}

check_tampered() {
  local tmp rc
  tmp="$(mktemp -d)"
  cp "$CKPT" "$tmp/candidate_online.pt"
  cp "${CKPT%.pt}.manifest.json" "$tmp/candidate_online.manifest.json"
  "$PY" - "$tmp/candidate_online.pt" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
b = bytearray(p.read_bytes())
b[len(b) // 2] ^= 0xFF
p.write_bytes(bytes(b))
PY
  (cd rl-defense && PYTHONPATH="$ROOT/rl-defense:$ROOT/shared:$ROOT/standards:$ROOT/examples/payments-lite/target" \
    "$PY" -m rl_defense.live.smoke --checkpoint "$tmp/candidate_online.pt" --pin "$PIN" --cpu \
    --episodes 1 --horizon 2 --out "$tmp/summary.json")
  rc=$?
  local repo_sha
  repo_sha="$(sha256_of "$CKPT")"
  rm -rf "$tmp"
  [ "$rc" -eq 2 ] || return 1
  [ "$repo_sha" = "$PIN" ] || return 1
  "$PY" -m pytest -q "$SERVING::test_tampered_checkpoint_reports_not_loaded"
}

check_ui() {
  command -v npx >/dev/null 2>&1 || { echo "npx not found; install Node 24 to run the UI check"; return 1; }
  (cd frontend && npx vitest run tests/unit/live-defense-rl-runtime.test.tsx)
}

echo "INFO: host $(uname -s) $(uname -m); requested device $DEVICE"
"$PY" -c "import torch; print('INFO: torch', torch.__version__, 'cuda', torch.cuda.is_available(), 'mps', torch.backends.mps.is_available())" 2>/dev/null \
  || echo "INFO: torch is not importable by $PY"

run_check a_pin "a. checkpoint sha256 matches the v6 pin" check_pin
run_check b_live_loop "b. live loop completed one payments-lite episode and wrote at least one transition" check_live_loop
run_check c_fresh "c. backend returned a decision or an explicit abstention for fresh owned-app telemetry" \
  "$PY" -m pytest -q "$SERVING::test_fresh_owned_telemetry_yields_decision_or_explicit_abstention"
run_check d_stale "d. stale telemetry produced an abstention with a reason" \
  "$PY" -m pytest -q "$SERVING::test_stale_owned_telemetry_abstains_with_reason"
run_check e_unmapped "e. unmapped route produced the documented skipped_schema abstention" \
  "$PY" -m pytest -q "$SERVING::test_unmapped_route_abstains_with_reason"
run_check f_tampered "f. tampered temporary checkpoint copy was refused and reported not loaded" check_tampered
run_check g_no_torch "g. with torch unavailable the API reported not loaded with a reason" \
  "$PY" -m pytest -q "$SERVING::test_torch_unavailable_reports_not_loaded"
run_check h_ui "h. UI card rendered not loaded correctly" check_ui

echo "SUMMARY: $PASSED passed, $FAILED failed, $((PASSED + FAILED)) checks on $(uname -s) $(uname -m)"
[ "$FAILED" -eq 0 ]
