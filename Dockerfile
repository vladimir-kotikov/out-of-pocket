FROM node:18

RUN apt-get update && apt-get install -y --no-install-recommends chromium

WORKDIR /opt/app
COPY package.json package-lock.json index.mjs epub.css ./
RUN npm install

VOLUME /opt/app/last_fetch.dat

ENTRYPOINT ["node"]
CMD ["index.mjs"]
