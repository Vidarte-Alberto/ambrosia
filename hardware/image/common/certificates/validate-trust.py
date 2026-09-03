#!/usr/bin/env python3
"""Provision a rendered Caddyfile using disposable storage, never image PKI."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def validate(template, binary="caddy"):
    with tempfile.TemporaryDirectory(prefix="ambrosia-caddy-validation-") as directory:
        temp = Path(directory)
        source = temp / "Caddyfile"
        source.write_text(template.replace("__HOSTNAME__", "ambrosia-validation"))
        adapted = subprocess.run(
            [binary, "adapt", "--adapter", "caddyfile", "--config", str(source)],
            check=True,
            capture_output=True,
        )
        config = json.loads(adapted.stdout)
        config["storage"] = {"module": "file_system", "root": str(temp / "data")}
        for ca in (
            config.get("apps", {})
            .get("pki", {})
            .get("certificate_authorities", {})
            .values()
        ):
            ca["install_trust"] = False
        target = temp / "config.json"
        target.write_text(json.dumps(config))
        subprocess.run(
            [binary, "validate", "--config", str(target)],
            check=True,
            env={
                **os.environ,
                "XDG_DATA_HOME": str(temp / "data"),
                "XDG_CONFIG_HOME": str(temp / "config"),
            },
        )


if __name__ == "__main__":
    validate(Path(sys.argv[1]).read_text())
