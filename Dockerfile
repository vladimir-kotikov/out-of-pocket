FROM node:18

RUN apt-get update && apt-get install -y --no-install-recommends chromium
RUN git clone https://github.com/vladimir-kotikov/percollate.git /opt/percollate

WORKDIR /opt/app
COPY package.json package-lock.json index.js epub.css ./
RUN npm install && npm link ../percollate

VOLUME /opt/app/last_fetch.dat

ENTRYPOINT ["node"]
CMD ["index.js"]
