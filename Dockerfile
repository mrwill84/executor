FROM ubuntu:22.04

# Install necessary dependencies for running Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    xvfb curl libasound2 libatk-bridge2.0-0 libatk1.0-0

# Install Google Chrome
# Download and unpack Chrome
RUN set -ex && \
	curl -SL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /google-chrome-stable_current_amd64.deb 
RUN dpkg -i  /google-chrome-stable_current_amd64.deb 