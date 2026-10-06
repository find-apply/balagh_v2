#!/bin/sh
# Restarts the API only once no video is being rendered: a restart kills running jobs and the
# user sees "انقطع التصيير بإعادة تشغيل الخادم". Waits up to 15 minutes, then restarts anyway.
set -e
for i in $(seq 1 90); do
  if ! pgrep -f "remotion render" >/dev/null; then break; fi
  [ "$i" = 1 ] && echo "a render is running; waiting for it before restarting..."
  sleep 10
done
systemctl restart balagh-api
systemctl is-active balagh-api
