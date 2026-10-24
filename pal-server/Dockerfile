FROM mirror.gcr.io/library/node:22-slim
# ffmpeg turns the video's sound into mp3; yt-dlp downloads it. yt-dlp is installed fresh on every build
# because the sites change often and old versions stop working.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
  && pip3 install --no-cache-dir --break-system-packages yt-dlp \
  && rm -rf /var/lib/apt/lists/*
# YouTube needs a JavaScript runtime to read videos; Node is already in this image.
RUN printf -- "--js-runtimes node\n" > /etc/yt-dlp.conf
WORKDIR /srv
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
ENV PORT=8080
CMD ["node", "--import", "tsx", "src/index.ts"]
