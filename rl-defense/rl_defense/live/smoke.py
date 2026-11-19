from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, cast

import numpy as np

RL_ROOT = pathlib.Path(__file__).resolve().parents[2]
V6_CHECKPOINT = RL_ROOT / "results" / "live-retrain-v6" / "candidate_online.pt"
V6_SHA256 = "8113a37f4ff9360a9efed2e9f499c4b2ae36e97bfb78372436f97da106fc05f1"
LFS_POINTER_PREFIX = b"version https://git-lfs.github.com/spec/"
SUMMARY_KIND = "rl_live_smoke"


class SmokeError(RuntimeError):
    pass


def pick_device(requested: str) -> str:
    import torch

    if requested == "cpu":
        return "cpu"
    if requested == "cuda":
        if not torch.cuda.is_available():
            raise SmokeError("--device cuda requested but CUDA is not available")
        return "cuda"
    if requested == "mps":
        if not torch.backends.mps.is_available():
            raise SmokeError("--device mps requested but MPS is not available")
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def on_device(agent: Any, device: str) -> Callable[[np.ndarray], np.ndarray]:
    import torch

    def q_values(obs: np.ndarray) -> np.ndarray:
        with torch.no_grad():
            x = torch.as_tensor(obs, dtype=torch.float32, device=device).unsqueeze(0)
            return np.asarray(agent.online(x)[0].cpu().numpy())

    return q_values


def verify_checkpoint(path: pathlib.Path, pin: str | None) -> tuple[bytes, str]:
    if not path.is_file():
        raise SmokeError(f"checkpoint missing: {path}")
    blob = path.read_bytes()
    if blob.startswith(LFS_POINTER_PREFIX):
        raise SmokeError(f"checkpoint is a git LFS pointer stub, not weights: {path}")
    digest = hashlib.sha256(blob).hexdigest()
    if pin is None and path.resolve() == V6_CHECKPOINT.resolve():
        pin = V6_SHA256
    if pin is not None and digest != pin:
        raise SmokeError(f"checkpoint sha256 {digest} does not match pin {pin}; refusing to load")
    manifest_path = path.with_suffix(".manifest.json")
    if not manifest_path.is_file():
        raise SmokeError(f"manifest missing: {manifest_path}; refusing to load")
    try:
        expected = json.loads(manifest_path.read_text())["checkpoint_sha256"]
    except (ValueError, KeyError) as exc:
        raise SmokeError(f"manifest unreadable: {manifest_path}: {exc}") from exc
    if expected != digest:
        raise SmokeError(
            f"manifest checkpoint_sha256 {expected} does not match file {digest}; refusing to load"
        )
    return blob, digest


def run(args: argparse.Namespace) -> dict[str, Any]:
    started = time.monotonic()
    started_at = datetime.now(UTC)
    path = pathlib.Path(args.checkpoint)
    blob, digest = verify_checkpoint(path, args.pin)
    device = pick_device(args.device)

    from payments_lite.app import create_app

    from rl_defense.inference import PolicyRunner
    from rl_defense.live.adversary import live_app
    from rl_defense.live.loop import LiveDefenseLoop, LoopConfig

    runner = PolicyRunner(path, blob=blob)
    if device != "cpu":
        agent: Any = runner.agent
        agent.online.to(device)
        agent.q_values = on_device(agent, device)
    app_factory = create_app if runner.space == "sim" else live_app
    loop = LiveDefenseLoop(
        app_factory,
        runner,
        config=LoopConfig(horizon=args.horizon, action_space=cast(Any, runner.space)),
    )
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    transitions_path = out.with_name("transitions.jsonl")
    totals = dict.fromkeys(
        ("compromised", "attacks", "benign_blocked", "benign", "steps", "written"), 0
    )
    episodes = 0
    rewards: list[float] = []
    try:
        with transitions_path.open("w") as fh:
            for ep in range(args.episodes):
                ts = loop.run_episode(seed=args.seed + ep)
                episodes += 1
                rewards.append(round(sum(t.reward for t in ts), 6))
                for t in ts:
                    totals["compromised"] += t.outcome.compromised_reads
                    totals["attacks"] += t.outcome.attack_requests
                    totals["benign_blocked"] += t.outcome.benign_blocked
                    totals["benign"] += t.outcome.benign_requests
                    totals["steps"] += 1
                    fh.write(json.dumps({"episode": ep, **t.model_dump()}) + "\n")
                    totals["written"] += 1
    finally:
        loop.close()
    compromise_rate = totals["compromised"] / totals["attacks"] if totals["attacks"] else None
    availability = 1.0 - totals["benign_blocked"] / totals["benign"] if totals["benign"] else None
    passed = episodes == args.episodes and totals["written"] >= 1
    return {
        "kind": SUMMARY_KIND,
        "passed": passed,
        "episodes": episodes,
        "steps": totals["steps"],
        "compromise_rate": compromise_rate,
        "availability": availability,
        "transitions_written": totals["written"],
        "transitions_path": str(transitions_path),
        "checkpoint_path": str(path),
        "checkpoint_sha256": digest,
        "policy_version": runner.policy_version,
        "action_space": runner.space,
        "device": device,
        "seed": args.seed,
        "horizon": args.horizon,
        "episode_rewards": rewards,
        "started_at": started_at.isoformat(),
        "finished_at": datetime.now(UTC).isoformat(),
        "duration_s": round(time.monotonic() - started, 3),
        "target": "examples/payments-lite in-process (owned demo app)",
        "caveat": "Lab evidence from the owned demo app. Not proof of real-world effectiveness.",
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Seeded live-loop smoke run on payments-lite with a hash-pinned checkpoint"
    )
    ap.add_argument("--checkpoint", default=str(V6_CHECKPOINT))
    ap.add_argument("--pin", default=None, help="required sha256 (v6 path implies the v6 pin)")
    ap.add_argument("--device", choices=("auto", "cpu", "cuda", "mps"), default="auto")
    ap.add_argument("--cpu", action="store_true", help="same as --device cpu")
    ap.add_argument("--episodes", type=int, default=1)
    ap.add_argument("--horizon", type=int, default=10)
    ap.add_argument("--seed", type=int, default=1000)
    ap.add_argument("--out", default=str(RL_ROOT / "runs" / "live-smoke" / "summary.json"))
    args = ap.parse_args(argv)
    if args.cpu:
        args.device = "cpu"
    try:
        summary = run(args)
    except SmokeError as exc:
        print(f"RL LIVE SMOKE FAILED: {exc}", file=sys.stderr)
        return 2
    pathlib.Path(args.out).write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))
    if not summary["passed"]:
        print("RL LIVE SMOKE FAILED: no transition was written", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
