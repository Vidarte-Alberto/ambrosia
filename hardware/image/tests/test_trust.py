"""Public PKI export and real Caddy routing, using disposable state only."""

import http.client
import importlib.machinery
import importlib.util
import json
import os
import plistlib
import socket
import ssl
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

COMMON = Path(__file__).resolve().parents[1] / "common"
ASSETS = COMMON / "certificates"
loader = importlib.machinery.SourceFileLoader(
    "export_ca", str(ASSETS / "ambrosia-export-ca")
)
spec = importlib.util.spec_from_loader(loader.name, loader)
export_ca = importlib.util.module_from_spec(spec)
loader.exec_module(export_ca)


def load_module(name, path):
    specification = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


installer = load_module("install_trust", ASSETS / "install-trust.py")
validator = load_module("validate_trust", ASSETS / "validate-trust.py")


class InstallerTests(unittest.TestCase):
    def test_rollback_restores_original_permissions_and_removes_new_files(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(installer.os, "chown"),
        ):
            root = Path(directory)
            existing = root / "existing.conf"
            added = root / "new.conf"
            existing.write_bytes(b"original configuration")
            existing.chmod(0o640)
            files = {existing: (b"replacement", 0o644), added: (b"new asset", 0o644)}
            backup, original = installer.backup_files(files, root)
            for destination, (content, mode) in files.items():
                installer.install_file(destination, content, mode)
            installer.restore_files(files, original)
            self.assertEqual(existing.read_bytes(), b"original configuration")
            self.assertEqual(existing.stat().st_mode & 0o777, 0o640)
            self.assertFalse(added.exists())
            self.assertEqual(backup.stat().st_mode & 0o777, 0o700)

    def test_recognizes_image_and_bootstrap_but_refuses_custom_config(self):
        image = "{ local_certs } https://unit.local { tls internal reverse_proxy /ws/* 127.0.0.1:9154 reverse_proxy 127.0.0.1:3000 }"
        bootstrap = "{ debug local_certs } unit.local { tls internal reverse_proxy /ws/* localhost:9154 reverse_proxy localhost:3000 }"
        self.assertTrue(installer.known_configuration(image, "unit"))
        self.assertTrue(installer.known_configuration(bootstrap, "unit"))
        self.assertFalse(
            installer.known_configuration(
                image + "\nother.local { respond custom }", "unit"
            )
        )
        self.assertFalse(installer.known_configuration(image, "wrong-unit"))
        self.assertTrue(
            installer.known_configuration(image, "renamed-unit", managed=image)
        )

    def test_installing_assets_preserves_pki_and_other_application_state(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(installer.os, "chown"),
        ):
            root = Path(directory)
            pki = root / "var/lib/caddy/.local/share/caddy/pki"
            pki.mkdir(parents=True)
            (pki / "root.key").write_bytes(b"sentinel-key")
            installer.install_assets(root)
            first = (
                root / "usr/local/libexec/ambrosia/ambrosia-export-ca"
            ).read_bytes()
            installer.install_assets(root)
            self.assertEqual((pki / "root.key").read_bytes(), b"sentinel-key")
            self.assertEqual(
                (root / "usr/local/libexec/ambrosia/ambrosia-export-ca").read_bytes(),
                first,
            )
            self.assertFalse((root / "var/lib/ambrosia/trust").exists())
            self.assertEqual((root / "var/lib/ambrosia").stat().st_mode & 0o777, 0o755)

    def test_installer_rejects_symlinked_destination(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(installer.os, "chown"),
        ):
            root = Path(directory)
            (root / "etc").mkdir()
            (root / "etc/ambrosia").symlink_to(root)
            with self.assertRaises(ValueError):
                installer.install_assets(root)


def create_ca(directory, name="unit-a", ca=True):
    certificate = directory / f"{name}.crt"
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "ec",
            "-pkeyopt",
            "ec_paramgen_curve:P-256",
            "-nodes",
            "-keyout",
            str(directory / f"{name}.key"),
            "-out",
            str(certificate),
            "-days",
            "2",
            "-subj",
            f"/CN={name}",
            "-addext",
            f"basicConstraints=critical,CA:{str(ca).upper()}",
            "-addext",
            "keyUsage=critical,keyCertSign,cRLSign",
        ],
        check=True,
        capture_output=True,
    )
    return certificate


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = self.root / "state"
        self.state.mkdir()
        self.cert = create_ca(self.root)

    def publish(self, cert=None, host="ambrosia-test"):
        return export_ca.publish(cert or self.cert, host, ASSETS, self.state)

    def test_certificate_profile_and_metadata_have_identical_fingerprint(self):
        meta = self.publish()
        public = self.state / "trust"
        self.assertEqual({p.name for p in public.iterdir()}, export_ca.PUBLIC_FILES)
        fingerprint = (
            export_ca.openssl(
                "x509",
                "-inform",
                "DER",
                "-in",
                str(public / "ambrosia-ca.crt"),
                "-noout",
                "-fingerprint",
                "-sha256",
            )
            .decode()
            .strip()
            .split("=", 1)[1]
        )
        self.assertEqual(meta["sha256"], fingerprint)
        profile = plistlib.loads((public / "ambrosia-ca.mobileconfig").read_bytes())
        self.assertEqual(len(profile["PayloadContent"]), 1)
        self.assertEqual(
            profile["PayloadContent"][0]["PayloadType"], "com.apple.security.root"
        )
        self.assertEqual(
            profile["PayloadContent"][0]["PayloadContent"],
            (public / "ambrosia-ca.crt").read_bytes(),
        )
        for path in public.iterdir():
            content = path.read_bytes()
            self.assertEqual(path.stat().st_mode & 0o777, 0o644)
            self.assertNotIn(b"PRIVATE KEY", content)
            if path.suffix == ".html":
                self.assertNotIn(b"__HOSTNAME__", content)
                self.assertNotIn(b"__FINGERPRINT__", content)
        guide = (public / "index.html").read_text()
        self.assertIn('<html lang="en">', guide)
        self.assertLess(guide.index('id="es"'), guide.index('id="en"'))
        self.assertEqual(guide.count('name="platform-en"'), 6)
        self.assertEqual(guide.count('name="platform-es"'), 6)
        self.assertEqual(guide.count('<summary>'), 14)
        for instruction in (
            "VPN y gestión de dispositivos",
            "VPN &amp; Device Management",
            "Trusted Root Certification Authorities",
            "Entidades de certificación raíz de confianza",
            "security.enterprise_roots.enabled",
        ):
            self.assertIn(instruction, guide)
        self.assertEqual(public.stat().st_mode & 0o777, 0o755)

    def test_reexport_is_identical_and_never_changes_private_key(self):
        private = self.cert.with_suffix(".key").read_bytes()
        first = self.publish()
        target = (self.state / "trust").readlink()
        files = {p.name: p.read_bytes() for p in (self.state / "trust").iterdir()}
        self.assertEqual(first, self.publish())
        self.assertEqual(target, (self.state / "trust").readlink())
        self.assertEqual(
            files, {p.name: p.read_bytes() for p in (self.state / "trust").iterdir()}
        )
        self.assertEqual(private, self.cert.with_suffix(".key").read_bytes())

    def test_independent_ca_and_hostname_change(self):
        first = self.publish()
        renamed = self.publish(host="ambrosia-renamed")
        self.assertEqual(first["sha256"], renamed["sha256"])
        self.assertEqual(renamed["trustUrl"], "http://ambrosia-renamed.local/trust/")
        second = self.publish(create_ca(self.root, "unit-b"))
        self.assertNotEqual(first["sha256"], second["sha256"])
        self.assertEqual(len(list((self.state / "trust-generations").iterdir())), 2)

    def test_rejects_private_material_bundle_and_truncated_certificate(self):
        good = self.cert.read_bytes()
        for bad in (
            good + self.cert.with_suffix(".key").read_bytes(),
            good + good,
            good[:50],
            b"invalid",
        ):
            with self.subTest(bad=bad[:20]):
                self.cert.write_bytes(bad)
                with self.assertRaises((ValueError, subprocess.SubprocessError)):
                    self.publish()
                self.assertFalse((self.state / "trust").exists())

    def test_rejects_leaf_certificate_and_invalid_hostname(self):
        with self.assertRaises(ValueError):
            self.publish(create_ca(self.root, "leaf", ca=False))
        for host in ("../evil", "-bad", "two.local", "x\nroot", "a" * 64):
            with self.subTest(host=host), self.assertRaises(ValueError):
                self.publish(host=host)

    def test_rejects_symlink_source_and_generation_directory(self):
        link = self.root / "link.crt"
        link.symlink_to(self.cert)
        with self.assertRaises(OSError):
            self.publish(link)
        (self.state / "trust-generations").symlink_to(self.root)
        with self.assertRaises(ValueError):
            self.publish()

    def test_failure_does_not_partially_replace_generation(self):
        self.publish()
        target = (self.state / "trust").readlink()
        self.cert.write_text("broken")
        with self.assertRaises(ValueError):
            self.publish()
        self.assertEqual(target, (self.state / "trust").readlink())
        # Production error handling withdraws the public pointer.
        export_ca.unpublish(self.state)
        self.assertFalse((self.state / "trust").exists())

    def test_does_not_replace_unmanaged_directory(self):
        public = self.state / "trust"
        public.mkdir()
        (public / "keep").write_text("unmanaged")
        with self.assertRaises(ValueError):
            self.publish()
        self.assertEqual((public / "keep").read_text(), "unmanaged")

    def test_detects_tampered_existing_generation(self):
        self.publish()
        (self.state / "trust/ambrosia-ca.crt").write_bytes(b"wrong certificate")
        with self.assertRaises(ValueError):
            self.publish()


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@unittest.skipUnless(
    os.environ.get("CADDY_BIN"), "Set CADDY_BIN to run real HTTP/HTTPS tests"
)
class CaddyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.state = cls.root / "state"
        cls.state.mkdir()
        cls.http_port, cls.https_port = free_port(), free_port()
        config = (COMMON / "templates/Caddyfile.template").read_text()
        config = config.replace(
            "http://__HOSTNAME__.local {",
            f"http://ambrosia-test.local:{cls.http_port} {{",
        )
        config = config.replace(
            "https://__HOSTNAME__.local {",
            f"https://ambrosia-test.local:{cls.https_port} {{",
        )
        config = config.replace("__HOSTNAME__", "ambrosia-test")
        config = config.replace("/var/lib/ambrosia/trust", str(cls.state / "trust"))
        config = config.replace(
            "/run/caddy-admin/admin.sock", str(cls.root / "admin.sock")
        )
        config = config.replace(
            "  local_certs",
            f"  http_port {cls.http_port}\n  https_port {cls.https_port}\n  storage file_system {cls.root / 'data'}\n  local_certs",
            1,
        )
        cls.config_path = cls.root / "Caddyfile"
        cls.config_path.write_text(config)
        cls.log = (cls.root / "caddy.log").open("w+")
        cls.addClassCleanup(cls.log.close)
        cls.process = subprocess.Popen(
            [
                os.environ["CADDY_BIN"],
                "run",
                "--config",
                str(cls.config_path),
                "--adapter",
                "caddyfile",
            ],
            stdout=cls.log,
            stderr=cls.log,
        )
        cls.addClassCleanup(cls.stop)
        cls.cert = cls.root / "data/pki/authorities/local/root.crt"
        for _ in range(100):
            if cls.process.poll() is not None:
                cls.log.seek(0)
                raise RuntimeError(cls.log.read())
            if cls.cert.exists():
                try:
                    with socket.create_connection(
                        ("127.0.0.1", cls.https_port), timeout=0.2
                    ):
                        pass
                    export_ca.publish(cls.cert, "ambrosia-test", ASSETS, cls.state)
                    break
                except OSError:
                    pass
            time.sleep(0.1)
        else:
            raise RuntimeError("Caddy did not create a CA")

    @classmethod
    def stop(cls):
        cls.process.terminate()
        cls.process.wait(timeout=10)

    def request(self, path, https=False, method="GET", trusted=True):
        port = self.https_port if https else self.http_port
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        if https:
            context = ssl.create_default_context(
                cafile=str(self.cert) if trusted else None
            )
            connection.sock = context.wrap_socket(
                socket.create_connection(("127.0.0.1", port)),
                server_hostname="ambrosia-test.local",
            )
        try:
            connection.request(
                method, path, headers={"Host": f"ambrosia-test.local:{port}"}
            )
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_http_serves_allowlist_and_preserves_other_redirects(self):
        for path in (
            "/trust/",
            "/trust/metadata.json",
            "/trust/ambrosia-ca.crt",
            "/trust/ambrosia-ca.mobileconfig",
        ):
            self.assertEqual(self.request(path)[0], 200, path)
        self.assertEqual(self.request("/trust")[1]["Location"], "/trust/")
        self.assertEqual(
            self.request("/store/settings")[1]["Location"],
            "https://ambrosia-test.local/store/settings",
        )
        for path in (
            "/trust/root.key",
            "/trust/.staging/secret",
            "/trust/backup",
            "/trust/trust.lock",
        ):
            self.assertEqual(self.request(path)[0], 404, path)
        self.assertEqual(self.request("/trust/metadata.json", method="POST")[0], 405)

    def test_mime_cache_headers_and_https_without_app(self):
        for path, mime in (
            ("ambrosia-ca.crt", "application/x-x509-ca-cert"),
            ("ambrosia-ca.mobileconfig", "application/x-apple-aspen-config"),
        ):
            status, headers, _ = self.request("/trust/" + path)
            self.assertEqual(status, 200)
            self.assertEqual(headers["Content-Type"], mime)
            self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(self.request("/trust/check.html", https=True)[0], 200)
        _, _, body = self.request("/trust/metadata.json", https=True)
        self.assertEqual(json.loads(body)["hostname"], "ambrosia-test.local")
        with self.assertRaises(ssl.SSLCertVerificationError):
            self.request("/trust/check.html", https=True, trusted=False)

    def test_reload_keeps_the_same_root(self):
        before = self.cert.read_bytes()
        subprocess.run(
            [
                os.environ["CADDY_BIN"],
                "reload",
                "--config",
                str(self.config_path),
                "--adapter",
                "caddyfile",
                "--address",
                f"unix/{self.root}/admin.sock",
                "--force",
            ],
            check=True,
            capture_output=True,
        )
        self.assertEqual(self.cert.read_bytes(), before)
        self.assertEqual(self.request("/trust/metadata.json", https=True)[0], 200)

    def test_validation_does_not_change_existing_pki(self):
        before = self.cert.read_bytes()
        validator.validate(
            (COMMON / "templates/Caddyfile.template").read_text(),
            binary=os.environ["CADDY_BIN"],
        )
        self.assertEqual(self.cert.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
