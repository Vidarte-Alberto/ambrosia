"""Exercise only the credential function with isolated system-command targets."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path


class FirstbootPasswordTests(unittest.TestCase):
    def test_random_password_is_unique_private_and_not_in_logs(self):
        first = self.run_function("")
        second = self.run_function("")
        self.assertNotEqual(first["credential"], second["credential"])
        self.assertEqual(len(first["credential"].split(":")[1]), 24)
        self.assertEqual(first["mode"], 0o600)
        self.assertIn(first["credential"].split(":")[1], first["console"])
        self.assertEqual(first["logs"], "")

    def test_preseed_is_applied_without_leaving_a_stale_password_file(self):
        result = self.run_function("operator-selected-password")
        self.assertEqual(result["credential"], "ambrosia:operator-selected-password")
        self.assertIsNone(result["mode"])
        self.assertEqual(result["console"], "")

    def run_function(self, password):
        source = (
            Path(__file__).resolve().parents[1] / "common/firstboot/ambrosia-firstboot"
        ).read_text()
        function = (
            "apply_admin_password() {"
            + source.split("apply_admin_password() {", 1)[1].split("\n}\n", 1)[0]
            + "\n}\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            console = root / "console"
            console.touch()
            (root / "operator-password").write_text("stale")
            function = function.replace("/dev/console", str(console))
            script = (
                """set -euo pipefail
install() { command install -m 0600 /dev/null "${@: -1}"; }
chpasswd() { cat > "$STATE_DIR/captured"; }
"""
                + function
                + "apply_admin_password\n"
            )
            result = subprocess.run(
                ["bash"],
                input=script,
                text=True,
                check=True,
                capture_output=True,
                env={
                    **os.environ,
                    "STATE_DIR": directory,
                    "OPERATOR_USER": "ambrosia",
                    "ambrosia_admin_password": password,
                },
            )
            stored = root / "operator-password"
            return {
                "credential": (root / "captured").read_text().strip(),
                "mode": stored.stat().st_mode & 0o777 if stored.exists() else None,
                "console": console.read_text(),
                "logs": result.stdout + result.stderr,
            }
