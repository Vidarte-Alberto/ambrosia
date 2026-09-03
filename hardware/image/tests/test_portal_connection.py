"""Test Flask requests and radio recovery with all device commands mocked."""

import importlib.machinery
import importlib.util
import io
import subprocess
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import Mock, patch

PORTAL = Path(__file__).resolve().parents[1] / "common/portal/ambrosia-wifi-portal"


class PortalConnectionTests(unittest.TestCase):
    def setUp(self):
        loader = importlib.machinery.SourceFileLoader("wifi_portal", str(PORTAL))
        spec = importlib.util.spec_from_loader(loader.name, loader)
        self.portal = importlib.util.module_from_spec(spec)
        loader.exec_module(self.portal)
        self.client = self.portal.app.test_client()

    def test_duplicate_requests_do_not_start_two_radio_switches(self):
        with patch.object(self.portal.threading, "Thread") as thread:
            first = self.client.post(
                "/commit", data={"ssid": "Cafe", "password": "secret"}
            )
            second = self.client.post(
                "/commit", data={"ssid": "Other", "password": "other"}
            )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 409)
        thread.assert_called_once_with(
            target=self.portal._do_connect, args=("Cafe", "secret"), daemon=True
        )
        self.assertEqual(first.headers["Cache-Control"], "no-store")

    def test_empty_ssid_is_rejected_without_switching_radio(self):
        with patch.object(self.portal.threading, "Thread") as thread:
            response = self.client.post("/commit", data={"ssid": " "})
        self.assertEqual(response.status_code, 400)
        thread.assert_not_called()

    def test_worker_start_failure_allows_retry(self):
        with patch.object(self.portal.threading, "Thread") as thread:
            thread.return_value.start.side_effect = RuntimeError("no threads")
            response = self.client.post("/commit", data={"ssid": "Cafe"})
        self.assertEqual(response.status_code, 503)
        self.assertFalse(self.portal.connection_lock.locked())

    def test_confirmation_escapes_credentials_and_is_not_cached(self):
        with patch.object(self.portal, "get_hostname", return_value="ambrosia-test"):
            response = self.client.post(
                "/", data={"ssid": "<script>alert(1)</script>", "password": '"<secret>'}
            )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(b"<script>alert(1)</script>", response.data)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(response.headers["Referrer-Policy"], "no-referrer")

    def test_failed_or_timed_out_connection_restores_hotspot_and_releases_lock(self):
        for failure in (
            None,
            subprocess.TimeoutExpired(["nmcli", "password", "private-secret"], 60),
            OSError("private-secret"),
        ):
            with self.subTest(failure=type(failure).__name__):
                self.portal.connection_lock.acquire()
                output = io.StringIO()
                with (
                    patch.object(self.portal.time, "sleep"),
                    patch.object(self.portal, "stop_ap") as stop,
                    patch.object(self.portal, "start_ap", return_value=True) as start,
                    patch.object(
                        self.portal,
                        "sh",
                        return_value=Mock(returncode=1),
                        side_effect=failure,
                    ),
                    redirect_stdout(output),
                ):
                    self.portal._do_connect("Cafe", "private-secret")
                stop.assert_called_once()
                start.assert_called_once()
                self.assertFalse(self.portal.connection_lock.locked())
                self.assertNotIn("private-secret", output.getvalue())

    def test_success_exits_without_restarting_hotspot(self):
        self.portal.connection_lock.acquire()
        with (
            patch.object(self.portal.time, "sleep"),
            patch.object(self.portal, "stop_ap"),
            patch.object(self.portal, "start_ap") as start,
            patch.object(self.portal, "sh", return_value=Mock(returncode=0)),
            patch.object(
                self.portal.os, "_exit", side_effect=SystemExit
            ) as exit_process,
        ):
            with self.assertRaises(SystemExit):
                self.portal._do_connect("Cafe", "secret")
        exit_process.assert_called_once_with(0)
        start.assert_not_called()

    def test_monitor_does_not_touch_radio_during_connection(self):
        self.portal.connection_lock.acquire()
        with (
            patch.object(self.portal.time, "sleep", side_effect=[None, SystemExit]),
            patch.object(self.portal, "wifi_is_real") as wifi,
            patch.object(self.portal, "stop_ap") as stop,
        ):
            with self.assertRaises(SystemExit):
                self.portal._monitor_connection()
        wifi.assert_not_called()
        stop.assert_not_called()

    def test_hotspot_recovery_failure_requests_service_restart(self):
        self.portal.connection_lock.acquire()
        with (
            patch.object(self.portal.time, "sleep"),
            patch.object(self.portal, "stop_ap"),
            patch.object(self.portal, "sh", return_value=Mock(returncode=1)),
            patch.object(self.portal, "start_ap", side_effect=OSError),
            patch.object(
                self.portal.os, "_exit", side_effect=SystemExit
            ) as exit_process,
        ):
            with self.assertRaises(SystemExit):
                self.portal._do_connect("Cafe", "secret")
        exit_process.assert_called_once_with(1)
        self.assertFalse(self.portal.connection_lock.locked())
