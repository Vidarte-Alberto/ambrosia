#!/usr/bin/env python3
"""Install trust assets into an image, or migrate a known live Caddyfile.

Live updates are explicit (--apply), retain PKI, and refuse custom Caddyfiles.
Run from a trusted checkout. No network downloads are performed here.
"""

import argparse
import importlib.util
import json
import os
import pwd
import re
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
COMMON = HERE.parent
PRIVATE_ADMIN_ADDRESS = "unix//run/caddy-admin/admin.sock"
EXPORT_UNITS = (
    "ambrosia-export-ca.service",
    "ambrosia-export-ca.path",
    "ambrosia-export-ca.timer",
)


def render_configuration(hostname):
    return (
        (COMMON / "templates/Caddyfile.template")
        .read_text()
        .replace("__HOSTNAME__", hostname)
    )


def unit_status(operation, unit):
    return (
        subprocess.run(
            ["systemctl", operation, "--quiet", unit], capture_output=True
        ).returncode
        == 0
    )


def command(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def normalized(text):
    return " ".join(re.sub(r"(?m)^\s*#.*$", "", text).split())


def known_configuration(current, hostname, managed=None):
    if managed is not None and normalized(current) == normalized(managed):
        return True
    for prefix in ("", "https://"):
        for address in ("localhost", "127.0.0.1"):
            for debug in ("", "debug"):
                old = f"{{ {debug} local_certs }} {prefix}{hostname}.local {{ tls internal reverse_proxy /ws/* {address}:9154 reverse_proxy {address}:3000 }}"
                if normalized(current) == normalized(old):
                    return True
    return normalized(current) == normalized(render_configuration(hostname))


def asset_files():
    files = {
        "/usr/local/libexec/ambrosia/ambrosia-export-ca": (
            HERE / "ambrosia-export-ca",
            0o755,
        ),
        "/usr/local/libexec/ambrosia/validate-trust.py": (
            HERE / "validate-trust.py",
            0o755,
        ),
        "/etc/ambrosia/Caddyfile.template": (
            COMMON / "templates/Caddyfile.template",
            0o644,
        ),
        "/etc/systemd/system/caddy.service.d/ambrosia-trust.conf": (
            HERE / "caddy-trust.conf",
            0o644,
        ),
    }
    for name in ("index.html", "check.html"):
        files[f"/usr/local/share/ambrosia/trust/{name}"] = (HERE / name, 0o644)
    for extension in ("service", "path", "timer"):
        name = f"ambrosia-export-ca.{extension}"
        files[f"/etc/systemd/system/{name}"] = (HERE / name, 0o644)
    return files


def safe_parent(path, boundary):
    """Reject symlinks rather than following them while installing as root."""
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError(f"Refusing symlink: {part}")
        if part == boundary:
            break


def install_file(destination, content, mode=0o644):
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(
        prefix=".ambrosia-", dir=destination.parent
    )
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.chown(temporary, 0, 0)
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def prepare_asset_directories(root):
    for directory in (
        "var/lib/ambrosia",
        "etc/ambrosia",
        "usr/local/libexec/ambrosia",
        "usr/local/share/ambrosia/trust",
    ):
        target = root / directory
        safe_parent(target, root)
        target.mkdir(parents=True, exist_ok=True)
        target.chmod(0o755)
        os.chown(target, 0, 0)


def install_assets(root):
    prepare_asset_directories(root)
    for relative, (source, mode) in asset_files().items():
        destination = root / relative.lstrip("/")
        safe_parent(destination, root)
        install_file(destination, source.read_bytes(), mode)


def validate(config):
    spec = importlib.util.spec_from_file_location(
        "validate_trust", HERE / "validate-trust.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.validate(config)


def backup_files(files, state):
    backup = Path(tempfile.mkdtemp(prefix="trust-migration-", dir=state))
    backup.chmod(0o700)
    original = {}
    for index, destination in enumerate(files):
        if destination.exists():
            original[destination] = (
                destination.read_bytes(),
                destination.stat().st_mode & 0o777,
            )
            (backup / str(index)).write_bytes(original[destination][0])
    (backup / "manifest.json").write_text(
        json.dumps({str(path): index for index, path in enumerate(files)}, indent=2)
    )
    return backup, original


def restore_files(files, original):
    for destination in files:
        if destination in original:
            install_file(destination, *original[destination])
        else:
            destination.unlink(missing_ok=True)


def migrate(apply):
    hostname = Path("/etc/hostname").read_text().strip().lower()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", hostname):
        raise ValueError("Expected a single DNS hostname label")
    caddyfile = Path("/etc/caddy/Caddyfile")
    current = caddyfile.read_text()
    managed_file = Path("/etc/ambrosia/Caddyfile.managed")
    managed = None
    if managed_file.exists() and all(
        not path.is_symlink()
        and path.stat().st_uid == 0
        and not path.stat().st_mode & 0o022
        for path in (managed_file, *managed_file.parents)
    ):
        managed = managed_file.read_text()
    if not known_configuration(current, hostname, managed):
        raise ValueError(
            "Custom Caddyfile: no changes made. Integrate the template manually; see certificates/README.md."
        )
    if (
        Path("/opt/ambrosia/bin/ambrosia-firstboot").exists()
        and not Path("/var/lib/ambrosia/firstboot-complete").exists()
    ):
        raise ValueError("First boot must complete before migrating this unit")
    candidate = render_configuration(hostname)
    validate(candidate)
    if not apply:
        print(
            "Known configuration; validation passed. Use --apply to install. PKI will be preserved."
        )
        return

    root = Path("/")
    files = {
        root / relative.lstrip("/"): (source.read_bytes(), mode)
        for relative, (source, mode) in asset_files().items()
    }
    files[caddyfile] = (candidate.encode(), 0o644)
    files[managed_file] = (candidate.encode(), 0o644)
    # Both layouts use the same portal source; keep their executable location.
    portal_service = Path("/etc/systemd/system/ambrosia-wifi-portal.service")
    if portal_service.exists():
        portal = (
            "/opt/ambrosia/bin/ambrosia-wifi-portal"
            if "/opt/ambrosia/bin/" in portal_service.read_text()
            else "/usr/local/bin/ambrosia-wifi-portal"
        )
        files[Path(portal)] = (
            (COMMON / "portal/ambrosia-wifi-portal").read_bytes(),
            0o755,
        )
    for destination in files:
        safe_parent(destination, root)
    state = Path("/var/lib/ambrosia")
    safe_parent(state, root)
    state.mkdir(exist_ok=True)
    state.chmod(0o755)
    os.chown(state, 0, 0)
    # Repair ancestors of existing root-run image scripts; never recursively
    # change ownership of application data or a wallet during a TLS migration.
    for directory in (
        Path("/opt/ambrosia"),
        Path("/opt/ambrosia/bin"),
        Path("/etc/ambrosia"),
    ):
        safe_parent(directory, root)
        if directory.exists():
            directory.chmod(0o755)
            os.chown(directory, 0, 0)
    backup, original = backup_files(files, state)
    active = unit_status("is-active", "caddy")
    triggers = EXPORT_UNITS
    enabled_before = {unit: unit_status("is-enabled", unit) for unit in triggers}
    active_before = {unit: unit_status("is-active", unit) for unit in triggers}
    old_address = (
        PRIVATE_ADMIN_ADDRESS
        if f"admin {PRIVATE_ADMIN_ADDRESS}" in current
        else "localhost:2019"
    )
    try:
        prepare_asset_directories(root)
        for destination, (content, mode) in files.items():
            install_file(destination, content, mode)
        admin = Path("/run/caddy-admin")
        safe_parent(admin, root)
        admin.mkdir(exist_ok=True)
        account = pwd.getpwnam("caddy")
        os.chown(admin, account.pw_uid, account.pw_gid)
        admin.chmod(0o700)
        command("systemctl", "daemon-reload")
        if active:
            command(
                "caddy",
                "reload",
                "--config",
                str(caddyfile),
                "--address",
                old_address,
                "--force",
            )
            command("/usr/local/libexec/ambrosia/ambrosia-export-ca")
        command("systemctl", "enable", *triggers)
        command(
            "systemctl", "start", "ambrosia-export-ca.path", "ambrosia-export-ca.timer"
        )
    except Exception:
        subprocess.run(["systemctl", "stop", *triggers], check=False)
        for unit in triggers:
            if not enabled_before[unit]:
                subprocess.run(["systemctl", "disable", unit], check=False)
        restore_files(files, original)
        command("systemctl", "daemon-reload")
        if active:
            # Reload may have switched sockets before a later step failed.
            for address in (PRIVATE_ADMIN_ADDRESS, old_address):
                if (
                    subprocess.run(
                        [
                            "caddy",
                            "reload",
                            "--config",
                            str(caddyfile),
                            "--address",
                            address,
                            "--force",
                        ],
                        capture_output=True,
                    ).returncode
                    == 0
                ):
                    break
        for unit in triggers:
            if active_before[unit]:
                subprocess.run(["systemctl", "start", unit], check=False)
        raise
    print(f"Trust support installed; CA preserved. Configuration backup: {backup}")
    print(
        "Existing application accounts and port bindings were retained. Complete the legacy isolation checklist in certificates/README.md before production rollout."
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--image-root", type=Path)
    group.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error(
            "Run as root; without --apply this validates the live configuration only"
        )
    if args.image_root:
        if args.image_root.resolve() == Path("/"):
            parser.error("Use --apply for the running system")
        install_assets(args.image_root.resolve())
    else:
        migrate(args.apply)


if __name__ == "__main__":
    main()
