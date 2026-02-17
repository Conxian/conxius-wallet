#!/bin/bash
# Bisq Node Startup Script for Debian 11 (Bullseye)
# Installs Bisq Daemon and dependencies (Java 11+, Tor)

set -e

# 1. Update and Install Dependencies
apt-get update
apt-get install -y openjdk-17-jre-headless wget unzip tor

# 2. Setup User
useradd -m -s /bin/bash bisq
mkdir -p /home/bisq/.local/share/Bisq
chown -R bisq:bisq /home/bisq

# 3. Download Bisq (v1.9.14)
# Note: Always check for latest version. This is hardcoded for example.
BISQ_VERSION="1.9.14"
wget https://github.com/bisq-network/bisq/releases/download/v${BISQ_VERSION}/Bisq-64bit-${BISQ_VERSION}.deb -O /tmp/bisq.deb

# 4. Install
dpkg -i /tmp/bisq.deb || apt-get install -f -y

# 5. Create Systemd Service
cat <<EOF > /etc/systemd/system/bisq-daemon.service
[Unit]
Description=Bisq Daemon
After=network.target

[Service]
User=bisq
Group=bisq
# API Port 9998, headless mode
ExecStart=/opt/bisq/bin/Bisq --headless --apiPort=9998 --apiPassword=CHANGE_ME_IN_PRODUCTION
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 6. Start Service
systemctl daemon-reload
systemctl enable bisq-daemon
systemctl start bisq-daemon

echo "Bisq Daemon installed and started."
