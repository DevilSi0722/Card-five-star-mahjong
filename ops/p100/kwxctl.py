#!/usr/bin/python3
import configparser
import datetime
import fcntl
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import time
import urllib.request

BASE = Path(__file__).resolve().parents[2]
STATE = BASE / ".p100"
CONF = STATE / "supervisord.conf"
BRANCH = "feature/server-realtime-multiplayer"
PROGRAMS = ["kwx-web", "kwx-realtime", "kwx-gateway"]


def run(args, **kwargs):
    return subprocess.run([str(arg) for arg in args], check=True, **kwargs)


def capture(args, **kwargs):
    return run(args, stdout=subprocess.PIPE, text=True, **kwargs).stdout.strip()


def ctl(*args):
    return [STATE / "runtime/bin/supervisorctl", "-c", CONF, *args]


def link(name, target):
    temporary = STATE / (name + ".new")
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    temporary.replace(STATE / name)


def current(name="current"):
    path = STATE / name
    return path.resolve() if path.is_symlink() else None


def healthy(attempts=1):
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen("http://127.0.0.1:18140/_health/realtime", timeout=3) as response:
                assert json.load(response).get("service") == "kawuxing-realtime"
            with urllib.request.urlopen("http://127.0.0.1:18140/", timeout=5) as response:
                assert response.status == 200
            return True
        except Exception:
            if attempt + 1 < attempts:
                time.sleep(1)
    return False


def ensure():
    if (STATE / "disabled").exists() or current() is None:
        return
    probe = subprocess.run(ctl("pid"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    if probe.returncode:
        run([STATE / "runtime/bin/supervisord", "-c", CONF])
    else:
        for name in PROGRAMS:
            status = subprocess.run(ctl("status", name), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    text=True, timeout=10).stdout
            if any(state in status for state in ("FATAL", "EXITED", "STOPPED")):
                run(ctl("start", name))


def install():
    for directory in ("logs", "run", "releases", "bin"):
        (STATE / directory).mkdir(parents=True, exist_ok=True)
    if not (STATE / "runtime/bin/supervisord").exists():
        run(["/usr/bin/python3", "-m", "venv", STATE / "runtime"])
        run([STATE / "runtime/bin/pip", "install", "supervisor==4.3.0"])
    caddy = Path(os.environ.get("KWX_CADDY", "/data2/siran/work/AIserver/bin/caddy"))
    if not (STATE / "bin/caddy").exists():
        shutil.copy2(caddy, STATE / "bin/caddy")
    shutil.copy2(BASE / "ops/p100/Caddyfile", STATE / "Caddyfile")
    config = configparser.ConfigParser(interpolation=None)
    config["unix_http_server"] = {"file": str(STATE / "run/supervisor.sock"), "chmod": "0600"}
    config["supervisord"] = {
        "logfile": str(STATE / "logs/supervisord.log"), "logfile_maxbytes": "5MB", "logfile_backups": "3",
        "pidfile": str(STATE / "run/supervisord.pid"), "childlogdir": str(STATE / "logs"), "umask": "0077",
    }
    config["rpcinterface:supervisor"] = {"supervisor.rpcinterface_factory": "supervisor.rpcinterface:make_main_rpcinterface"}
    config["supervisorctl"] = {"serverurl": "unix://" + str(STATE / "run/supervisor.sock")}
    node = shutil.which("node")
    commands = {
        "kwx-web": [node, str(STATE / "current/node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "18141"],
        "kwx-realtime": [node, "--import", "tsx", "server/index.ts"],
        "kwx-gateway": [STATE / "bin/caddy", "run", "--config", STATE / "Caddyfile", "--adapter", "caddyfile"],
    }
    environment = 'NODE_ENV="production",NEXT_TELEMETRY_DISABLED="1",REALTIME_HOST="127.0.0.1",REALTIME_PORT="18142",CORS_ORIGIN="https://kwx.dscode.win,http://127.0.0.1:18140,http://localhost:18140"'
    for name, command in commands.items():
        config["program:" + name] = {
            "command": shlex.join(["/usr/bin/python3", str(BASE / "ops/p100/exec-supervised.py"), *map(str, command)]),
            "directory": str(STATE / "current"), "environment": environment,
            "autostart": "true", "autorestart": "true", "startsecs": "3", "startretries": "10",
            "stopwaitsecs": "30", "stopasgroup": "true", "killasgroup": "true", "redirect_stderr": "true",
            "stdout_logfile": str(STATE / ("logs/" + name + ".log")), "stdout_logfile_maxbytes": "10MB", "stdout_logfile_backups": "3",
        }
    with CONF.open("w") as output:
        config.write(output)
    run([STATE / "bin/caddy", "validate", "--config", STATE / "Caddyfile", "--adapter", "caddyfile"])
    helper = STATE / "bin/kwxctl"
    helper.unlink(missing_ok=True)
    helper.symlink_to(BASE / "ops/p100/kwxctl")
    result = subprocess.run(["crontab", "-l"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode and "no crontab" not in result.stderr:
        raise RuntimeError(result.stderr)
    cron = result.stdout
    if "# BEGIN KWX USER SERVICE" not in cron:
        (STATE / "crontab-before-install.txt").write_text(cron)
        cron = cron.rstrip() + "\n\n# BEGIN KWX USER SERVICE\n"
        command = "/usr/bin/timeout 90 " + shlex.quote(str(helper)) + " ensure >>" + shlex.quote(str(STATE / "logs/watchdog.log")) + " 2>&1"
        cron += "@reboot " + command + "\n* * * * * " + command + "\n# END KWX USER SERVICE\n"
        run(["crontab", "-"], input=cron, text=True)
    print("Installed independent Supervisor and reboot/minute watchdog", flush=True)


def activate(target):
    link("current", target)
    (STATE / "disabled").unlink(missing_ok=True)
    probe = subprocess.run(ctl("pid"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if probe.returncode == 0:
        run(ctl("restart", "kwx-web", "kwx-realtime"))
    ensure()
    if not healthy(45):
        raise RuntimeError("Origin health check failed; inspect .p100/logs")


def deploy(ref):
    if capture(["git", "status", "--porcelain"], cwd=BASE):
        raise RuntimeError("Commit source changes before deploying")
    run(["git", "fetch", "origin", BRANCH], cwd=BASE)
    if ref == BRANCH:
        ref = "origin/" + BRANCH
    commit = capture(["git", "rev-parse", ref + "^{commit}"], cwd=BASE)
    release = STATE / "releases" / (datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ") + "-" + commit[:12])
    release.mkdir()
    archive = subprocess.Popen(["git", "archive", commit], cwd=BASE, stdout=subprocess.PIPE)
    run(["tar", "-xf", "-", "-C", release], stdin=archive.stdout)
    archive.stdout.close()
    if archive.wait():
        raise RuntimeError("git archive failed")
    env = dict(os.environ, NODE_ENV="production", NEXT_TELEMETRY_DISABLED="1", NEXT_BUILD_CPUS="2")
    env.pop("NEXT_PUBLIC_REALTIME_URL", None)
    run(["npm", "ci", "--include=dev", "--no-audit", "--no-fund", "--fetch-timeout=60000",
         "--fetch-retries=2", "--maxsockets=2"], cwd=release, env=env)
    run(["npm", "run", "build"], cwd=release, env=env)
    run(["npm", "run", "check:realtime", "--", "--self-test"], cwd=release, env=env)
    (release / "release.json").write_text(json.dumps({"commit": commit, "release": release.name, "branch": BRANCH}, indent=2) + "\n")
    old = current()
    print("Activating " + release.name, flush=True)
    try:
        activate(release)
        run(["npm", "run", "check:realtime", "--", "http://127.0.0.1:18140"], cwd=release, env=env)
    except BaseException:
        if old:
            print("Restoring previous release", flush=True)
            activate(old)
        else:
            (STATE / "disabled").touch()
            subprocess.run(ctl("shutdown"))
            (STATE / "current").unlink(missing_ok=True)
        raise
    if old and old != release:
        link("previous", old)
    print("Deployed " + commit + " on http://127.0.0.1:18140", flush=True)


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "status"
    STATE.mkdir(exist_ok=True, mode=0o700)
    with (STATE / "operations.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | (fcntl.LOCK_NB if command == "ensure" else 0))
        if command == "install":
            install()
        elif command == "deploy":
            deploy(sys.argv[2] if len(sys.argv) > 2 else BRANCH)
        elif command == "rollback":
            target, old = current("previous"), current()
            if not target:
                raise RuntimeError("No previous release")
            try:
                activate(target)
            except BaseException:
                if old:
                    activate(old)
                raise
            if old:
                link("previous", old)
            print("Rolled back to " + target.name)
        elif command in ("start", "ensure"):
            if command == "start":
                (STATE / "disabled").unlink(missing_ok=True)
            ensure()
        elif command == "stop":
            (STATE / "disabled").touch()
            run(ctl("shutdown"))
        elif command == "status":
            run(ctl("status"))
            print("Origin healthy:", healthy())
        elif command == "version":
            target = current()
            print((target / "release.json").read_text() if target else "Not deployed")
        else:
            raise RuntimeError("Usage: kwxctl {install|deploy [ref]|rollback|start|stop|ensure|status|version}")


if __name__ == "__main__":
    try:
        main()
    except BlockingIOError:
        sys.exit(0)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
