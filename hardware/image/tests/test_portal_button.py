"""Execute the actual portal button script without touching network devices."""

import ast
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PORTALS = (
    ROOT / "hardware/image/common/portal/ambrosia-wifi-portal",
    ROOT / "hardware/preinstalled/portal/ambrosia-wifi-portal",
)

HARNESS = r"""
const assert = require('node:assert/strict');
const vm = require('node:vm');
const input = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
const elements = {};
for (const id of ['btn-go', 'pending', 'posurl', 'commit-form']) {
  elements[id] = {
    classList: { add(value) { this[value] = true; }, remove(value) { this[value] = false; } },
    addEventListener(event, handler) { this[event] = handler; },
  };
}
elements.posurl.textContent = "http://ambrosia-test.local/trust/";
const posts = [];
const navigator = {};
if (input.mode === 'modern') {
  navigator.clipboard = { writeText: async () => {} };
} else if (input.mode === 'rejected') {
  navigator.clipboard = { writeText: async () => { throw Error('Denied'); } };
}
const context = {
  navigator,
  document: {
    getElementById: id => elements[id],
    createElement: () => ({
      style: {}, setAttribute() {}, focus() {}, select() {}, setSelectionRange() {},
    }),
    body: { appendChild() {}, removeChild() {} },
    execCommand: () => {
      if (input.mode === 'throws') throw Error('Clipboard blocked');
      return input.mode !== 'unavailable';
    },
    createRange: () => ({ selectNodeContents() {} }),
  },
  window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
  FormData: function(form) { this.form = form; },
  fetch: async (url, options) => {
    posts.push({ url, options });
    if (input.response === 'offline') throw Error('Network error');
    return { ok: input.response !== 'rejected' };
  },
};
vm.runInNewContext(input.script, context);
elements['btn-go'].click();
elements['btn-go'].click();
setImmediate(() => {
  assert.equal(posts.length, 1, 'click must send the Wi-Fi connection request');
  assert.equal(posts[0].url, '/commit');
  assert.equal(posts[0].options.method, 'POST');
  assert.equal(posts[0].options.body.form, elements['commit-form']);
  if (input.response !== 'ok') {
    assert.equal(elements['btn-go'].disabled, false, 'failed request must allow retry');
    assert.equal(elements['btn-go'].classList.done, false);
    assert.match(elements.pending.textContent, /No pudimos confirmar/);
    return;
  }
  assert.equal(elements['btn-go'].disabled, true);
  assert.equal(elements['btn-go'].classList.done, true, 'button must turn green');
  assert.equal(elements.pending.classList.show, true);
  assert.match(elements['btn-go'].textContent,
    ['unavailable', 'throws'].includes(input.mode) ? /Guarda la dirección/ : /Dirección copiada/);
});
"""


class PortalButtonTests(unittest.TestCase):
    def test_packaged_portals_are_identical(self):
        # Each deployment copies one standalone script; prevent fixes drifting.
        self.assertEqual(PORTALS[0].read_bytes(), PORTALS[1].read_bytes())

    def test_copy_and_connect_in_each_clipboard_mode(self):
        for path in PORTALS:
            tree = ast.parse(path.read_text())
            template = next(
                ast.literal_eval(node.value)
                for node in tree.body
                if isinstance(node, ast.Assign)
                and any(
                    isinstance(target, ast.Name) and target.id == "SUCCESS"
                    for target in node.targets
                )
            )
            script = template.split("<script>", 1)[1].split("</script>", 1)[0]
            for mode, response in [
                (mode, "ok")
                for mode in ("modern", "legacy", "rejected", "unavailable", "throws")
            ] + [("legacy", "offline"), ("legacy", "rejected")]:
                with self.subTest(
                    portal=str(path.relative_to(ROOT)),
                    clipboard=mode,
                    response=response,
                ):
                    result = subprocess.run(
                        ["node", "--unhandled-rejections=strict", "-e", HARNESS],
                        input=json.dumps(
                            {"script": script, "mode": mode, "response": response}
                        ),
                        text=True,
                        capture_output=True,
                        timeout=10,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
