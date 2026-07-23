# Temporary Web Console

The temporary web console is the preferred direction for one-time remote output retrieval.

It is different from sync-folder integration. Sync folders keep files in a shared local folder. The temporary web console exposes recent output only while the user explicitly enables it, then closes the access point again.

## Purpose

Use this when you need to inspect output from a remote fpasoterm session for maintenance or review, but do not want to keep data in a network drive or any persistent shared folder.

Initial scope:

- read-only access to recent selected output, diagnostics, and optional terminal log excerpts
- browser output is sanitized for common terminal control sequences such as ANSI CSI/OSC
- explicit start and stop
- short lifetime
- random access token
- no shell input from the browser
- no automatic public network exposure

## Security Model

The feature must be disabled by default.

The first implementation should bind only to `127.0.0.1` and print a URL with a random token:

```text
http://127.0.0.1:<port>/?token=<random-token>
```

Remote access should be done through a user-managed private path such as SSH port forwarding, Tailscale, WireGuard, or another VPN. fpasoterm should not open firewall ports automatically.

The token should be stored only in memory and discarded when the temporary web console stops. The console should also expire automatically after a configured TTL.

## Non-Goals

- No browser-to-terminal input in the first implementation.
- No persistent cloud storage.
- No OAuth requirement.
- No public sharing by default.
- No background always-on server.

## Configuration

```toml
[webConsole]
enabled = false
bind = "127.0.0.1"
port = 0
ttlSeconds = 900
maxBytes = 1048576
allowTerminalInput = false
```

`port = 0` means the OS chooses a free local port.

An example config is available at:

```text
examples/config/web-console.toml
```

## Launch Override

```sh
fpasoterm --web-console
fpasoterm --web-console --web-console-ttl 900
fpasoterm --web-console --web-console-bind 0.0.0.0 --web-console-port 18080
```

`--web-console` enables the titlebar `Web` menu for that launch. It does not start the HTTP server by itself.

`--web-console-bind 0.0.0.0` listens on every interface. If the generated URL is `http://0.0.0.0:18080/...`, use the machine's real IP address from another device, not `0.0.0.0`. For non-public access, prefer a private path such as SSH port forwarding, Tailscale, WireGuard, or VPN.

The titlebar exposes:

```text
Web Console -> Start
Web Console -> Copy URL
Web Console -> Stop
```

## Retrieval Flow

1. Start fpasoterm with `[webConsole].enabled = true` or `--web-console`.
2. Select `Web` -> `Start` on the machine that owns the fpasoterm window.
3. Copy the generated URL. `Start` copies it automatically, and `Copy URL` can copy it again.
4. If another machine needs access, create a private tunnel or VPN route. When using `0.0.0.0`, open the real host IP address in the browser.
5. Open the URL in a browser.
6. Copy the needed output.
7. Select `Web` -> `Stop`.

This keeps the feature aligned with maintenance and debugging, not long-term synchronization.
