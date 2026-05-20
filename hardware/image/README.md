# Ambrosia Image Build

This directory contains the tooling to produce reproducible, flashable SD card images for supported hardware targets with Ambrosia POS pre-installed and ready to boot.

The image embeds the full stack: Ambrosia server (Kotlin/Ktor), the Next.js client, Phoenixd (Lightning node), and Caddy as a reverse proxy. On first boot the device self-initializes — SSH host keys and the machine ID are regenerated, secrets are provisioned, and an optional preseed file is consumed to configure hostname, admin password, Wi-Fi country, and locale.

## Supported boards

| Board ID | Board | Base OS |
|---|---|---|
| `opi-zero-2w` | OrangePi Zero 2W | Debian Bookworm (official OPi image) |
| `rpi-zero-2w` | Raspberry Pi Zero 2W | Raspberry Pi OS Lite 64-bit Bookworm |

Each board has its own definition under `hardware/image/boards/<board-id>/`. Adding a new board only requires creating that directory with `board.env`, `packages.txt`, and `README.md`.

## What the build produces

A successful build writes three files to `hardware/image/out/`:

| File | Description |
|---|---|
| `ambrosia-<board-id>-<version>.img.gz` | Compressed flashable image |
| `ambrosia-<board-id>-<version>.sha256` | SHA-256 hash of the `.img.gz` |
| `ambrosia-<board-id>-<version>.manifest.json` | Build metadata (versions, commit, base image) |

### What is inside the image

The image is built from the board's official Debian Bookworm base. On top of it the assembler installs:

- **Runtime packages**: `temurin-21-jre`, `nodejs` 24, `caddy`, `network-manager`, `avahi-daemon`, `openssh-server`, `hostapd`, `dnsmasq`, and supporting utilities
- **Phoenixd** (`/usr/local/bin/phoenixd`, `phoenix-cli`) — the Lightning Network daemon
- **Ambrosia server** at `/opt/ambrosia/server/ambrosia.jar`
- **Ambrosia client** at `/opt/ambrosia/client/` (Next.js standalone build)
- **systemd services**: `ambrosia.service`, `ambrosia-client.service`, `phoenixd.service`, `caddy.service`, `ambrosia-firstboot.service`, `ambrosia-wifi-portal.service`
- All services run as the `ambrosia` system user (UID 1001)

## Host prerequisites

The assembler runs as root because it manages loop devices and chroot mounts. All tools below must be present before running a build.

**Required commands**:

```
7z          blkid       curl        e2fsck      gzip        losetup
lsblk       mount       node        npm         partx       parted
resize2fs   rsync       sha256sum   systemctl   tar         truncate
umount      unzip       xz
```

**Additional requirement on non-ARM64 hosts**:

```
qemu-aarch64-static
```

On a Debian/Ubuntu x86_64 machine you can install the missing tools with:

```bash
sudo apt install \
  p7zip-full curl rsync qemu-user-static \
  parted e2fsprogs util-linux xz-utils
```

**Java 21 and Node.js** are required on the host only if you build the client in `host` mode (the default on ARM64). On x86_64 the client is compiled inside a `linux/arm64` container, so only `docker` or `podman` is required instead.

## Base image

Each board defines its own base image in `hardware/image/boards/<board-id>/board.env`. Refer to the board's `README.md` for the expected filename and download page.

You can provide the image in any of these ways:

- **Local file** via `--base-image <path>` — accepts `.7z`, `.gz`, `.xz`, or `.img`
- **Direct download** via `--base-image-url <url>` — cached in `hardware/image/out/cache/` for subsequent runs
- **Environment variable** `AMBROSIA_BASE_IMAGE_PATH` or `AMBROSIA_BASE_IMAGE_URL`

> The cache directory (`hardware/image/out/cache/`) is never cleaned between builds. Subsequent runs reuse the downloaded archive automatically.

## Build

### Quick start (full image build)

Run from the repo root:

```bash
cd hardware/image/build

sudo CLIENT_BUILD_MODE=container \
  JAVA_HOME=/path/to/java21 \
  ./assemble-image.sh \
  --board opi-zero-2w \
  --base-image ~/Downloads/orangepizero2w_1.0.0_debian_bookworm_server_linux6.1.31.7z
```

For Raspberry Pi:

```bash
sudo CLIENT_BUILD_MODE=container \
  JAVA_HOME=/path/to/java21 \
  ./assemble-image.sh \
  --board rpi-zero-2w \
  --base-image ~/Downloads/2024-11-19-raspios-bookworm-arm64-lite.img.xz
```

This single command does everything: builds the server JAR and client, stages artifacts, assembles the image inside a chroot, verifies integrity, and emits the final compressed output.

On an ARM64 host, `CLIENT_BUILD_MODE` defaults to `host` and `JAVA_HOME` must point to a Java 21 installation. On x86_64, `CLIENT_BUILD_MODE=container` uses Docker or Podman to compile the client for `linux/arm64` without needing a local JDK.

### Building artifacts only (optional)

To compile and stage the server/client artifacts without assembling the full image — useful for iterating or caching the build step separately:

```bash
cd hardware/image/build
./build-artifacts.sh
```

Artifacts land in `hardware/image/out/staging/`. You can then run the full assembler with `--skip-artifacts-build` to reuse them:

```bash
sudo ./assemble-image.sh \
  --board opi-zero-2w \
  --skip-artifacts-build \
  --base-image ~/Downloads/orangepizero2w_...7z
```

### Build options

#### `build-artifacts.sh`

| Flag | Description |
|---|---|
| `--staging-dir <path>` | Override the staging output directory |
| `--version <value>` | Override the version label embedded in the manifest |
| `--client-build-mode <auto\|host\|container>` | How to compile the Next.js client (see below) |

Environment variables:

| Variable | Description |
|---|---|
| `CLIENT_BUILD_MODE` | `auto` (default) — uses `host` on ARM64, `container` elsewhere |
| `CLIENT_TARGET_PLATFORM` | Container platform (default: `linux/arm64`) |
| `CONTAINER_ENGINE` | Force `docker` or `podman` when multiple engines are installed |

#### `assemble-image.sh`

| Flag | Description |
|---|---|
| `--board <id>` | Board target — **required** (e.g. `opi-zero-2w`, `rpi-zero-2w`) |
| `--base-image <path>` | Local base image archive or `.img` file |
| `--base-image-url <url>` | Download base image and cache it |
| `--skip-artifacts-build` | Reuse an existing `out/staging/` directory |
| `--validate-only` | Check host prerequisites and inputs without building |
| `--keep-workdir` | Preserve the temporary work directory on exit (useful for debugging failures) |
| `--version <value>` | Override the version label in the image and manifest |

Environment variables:

| Variable | Description |
|---|---|
| `AMBROSIA_BASE_IMAGE_PATH` | Equivalent to `--base-image` |
| `AMBROSIA_BASE_IMAGE_URL` | Equivalent to `--base-image-url` |
| `IMAGE_EXPAND_SIZE` | How much to expand the base image before package installation (default: `4G`) |

> **Note**: The assembler deletes all previous image outputs in `out/` before each full rebuild. `out/cache/` is always preserved. File ownership inside `out/` is restored to the invoking user when the script exits, even after errors.

## Validate the image before flashing

Before writing the image to an SD card, you can mount it as a loop device and inspect its contents.

Decompress the image:

```bash
mkdir -p hardware/image/out/img-check
gzip -dc hardware/image/out/ambrosia-<board-id>-<version>.img.gz \
  > hardware/image/out/img-check/image.img
```

Attach it as a loop device and mount the root partition:

```bash
LOOPDEV=$(sudo losetup -f -P --show hardware/image/out/img-check/image.img)
sudo mount "${LOOPDEV}p2" /mnt/ambrosia-sd
```

> Use `lsblk $LOOPDEV` to identify the correct root partition number if it differs.

Verify that key artifacts are present and are valid text files (not corrupt ELF binaries — a common cross-compilation failure):

```bash
file /mnt/ambrosia-sd/opt/ambrosia/client/package.json
file /mnt/ambrosia-sd/opt/ambrosia/client/server.js
file /mnt/ambrosia-sd/opt/ambrosia/server/ambrosia.jar
```

Expected results: `package.json` is `JSON text data`, `server.js` is `JavaScript source`, `ambrosia.jar` is a `Java archive`.

Unmount and detach:

```bash
sudo umount /mnt/ambrosia-sd
sudo losetup -d "$LOOPDEV"
```

## Flash to microSD

Identify your SD card device:

```bash
lsblk
```

Flash the image (replace `/dev/sdX` with your device — **the whole disk, not a partition**):

```bash
gzip -dc hardware/image/out/ambrosia-<board-id>-<version>.img.gz \
  | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
sync
```

Verify the hash before booting:

```bash
sha256sum hardware/image/out/ambrosia-<board-id>-<version>.img.gz
cat hardware/image/out/ambrosia-<board-id>-<version>.sha256
```

Both lines must show the same hash.

## Preseed (optional)

You can pre-configure the device before its first boot by writing a `ambrosia-device.env` file to the boot partition of the SD card. This is useful for operator provisioning — you can ship a pre-configured device without needing to connect to it interactively.

Mount the boot partition after flashing:

```bash
sudo mount /dev/sdX1 /mnt/ambrosia-sd
```

> **Raspberry Pi note**: on RPi OS Bookworm the FAT boot partition is also partition 1 (`/dev/sdX1`). The `ambrosia-firstboot` script detects both `/boot/firmware/` and `/boot/` automatically — no extra configuration is needed.

Create the preseed file (an example is already on the image at `ambrosia-device.env.example` on the boot partition):

```bash
sudo tee /mnt/ambrosia-sd/ambrosia-device.env > /dev/null <<'EOF'
AMBROSIA_HOSTNAME=ambrosia-demo
AMBROSIA_ADMIN_PASSWORD=change-me
AMBROSIA_WIFI_COUNTRY=US
AMBROSIA_LANG=en_US.UTF-8
EOF

sync
sudo umount /mnt/ambrosia-sd
```

Supported keys:

| Key | Description | Default |
|---|---|---|
| `AMBROSIA_HOSTNAME` | Device hostname | `ambrosia-<board-short-name>-<machine-id-prefix>` (auto-generated) |
| `AMBROSIA_ADMIN_PASSWORD` | SSH and admin password for the `ambrosia` user | `Ambrosia2026!` |
| `AMBROSIA_WIFI_COUNTRY` | ISO 3166-1 alpha-2 country code for Wi-Fi regulations | `US` |
| `AMBROSIA_LANG` | System locale | `en_US.UTF-8` |

The preseed file is consumed and deleted on first boot. A copy is archived to `/var/lib/ambrosia/consumed-device.env` for auditing.

## First boot

First boot provisions the device and can take **1 to 3 minutes**. Progress is logged to `/var/log/ambrosia-firstboot.log`.

What happens on first boot:

1. A unique machine ID and SSH host keys are generated
2. The preseed file (if present) is loaded
3. Hostname, locale, Wi-Fi country, and admin password are applied
4. Phoenixd and Ambrosia configuration files are initialized from templates
5. The `ambrosia-firstboot` service marks itself complete and will not run again

**After first boot:**

- If the device cannot reach a known Wi-Fi network, a setup access point named `<hostname>-setup` will appear. Connect to it to configure Wi-Fi via the captive portal.
- Once connected, the POS interface is reachable at `http://<hostname>.local` (mDNS via Avahi) or directly at the device IP on port 80.
- SSH is available:
  - **User**: `ambrosia`
  - **Password**: the value set in `AMBROSIA_ADMIN_PASSWORD` (default: `Ambrosia2026!`)

## Troubleshooting

**The image loops at first boot or takes more than 5 minutes.**
SSH into the device and check `/var/log/ambrosia-firstboot.log`. If SSH is not yet available, connect a serial console or HDMI monitor.

**`assemble-image.sh` fails midway.**
Rerun with `--keep-workdir` to preserve the mounted work directory and inspect what went wrong. Use `--validate-only` first to confirm all host tools are present.

**The image validates correctly via loop mount but behaves incorrectly after flashing.**
Suspect the SD card or reader. Try a different card or use `conv=fsync` and an explicit `sync` after `dd`. Verify the hash against the `.sha256` file.

**The loop mount root partition is not `p2`.**
Run `lsblk /dev/loopX` after attaching the loop device to identify the correct partition number before mounting.

**Client JavaScript files appear as ELF binaries in the build.**
This indicates a cross-compilation failure where the container built native ARM64 binaries instead of JavaScript. Clean `out/staging/` and rebuild. If the issue persists with `container` mode, try `--client-build-mode host` on an ARM64 machine.

**`qemu-aarch64-static` not found on an x86_64 host.**
Install it with `sudo apt install qemu-user-static` (Debian/Ubuntu) or the equivalent for your distribution.
