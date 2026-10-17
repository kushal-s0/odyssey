"""Stop only a child process owned by the current launcher, including Windows shims."""
import os
import subprocess


def stop_child(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name=='nt':
        subprocess.run(['taskkill.exe','/PID',str(process.pid),'/T','/F'],
                       stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
    if process.poll() is None:
        process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
